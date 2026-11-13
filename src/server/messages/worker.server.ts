/**
 * Beskedkøens arbejder. Kaldes af Lovable Cron (POST /api/cron/messages) hvert minut.
 *
 *  – Bookinger og beskedjobs er gemt i samme transaktion; fejl her kan aldrig annullere en booking.
 *  – claim_message_jobs låser jobs med FOR UPDATE SKIP LOCKED, så to samtidige kørsler aldrig tager
 *    det samme job; dedupe_key forhindrer dobbelte jobs, og job-id sendes som idempotensnøgle.
 *  – Påmindelser tjekker bookingens aktuelle status og tid lige før afsendelse.
 *  – Midlertidige fejl prøves igen med stigende ventetid; permanente fejl markeres "failed" og vises
 *    under Fejlede beskeder, hvor ejeren kan sende igen.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";
import { toWhatsAppRecipient } from "@/lib/phone";

import { bookingLinkToken } from "../links.server";
import { sendEmail, sendPushToStaff, sendWhatsApp } from "./channels.server";
import { ChannelNotConfigured, PermanentSendError } from "./errors";
import {
  WHATSAPP_TEMPLATES,
  customerEmail,
  pushContent,
  renderEmailHtml,
  renderEmailText,
  staffEmail,
  whatsappParams,
  type MessageData,
} from "./templates";

type Job = Tables<"message_jobs">;
const NOT_CONFIGURED_RETRY_MIN = 15;

export type WorkerReport = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
  waiting: number;
  deferred: number;
};

export async function runMessageWorker(origin: string, budgetMs = 8000): Promise<WorkerReport> {
  const started = Date.now();
  const report: WorkerReport = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
    waiting: 0,
    deferred: 0,
  };
  const { data: jobs, error } = await supabaseAdmin.rpc("claim_message_jobs", { p_limit: 20 });
  if (error) throw new Error(`claim_message_jobs: ${error.message}`);
  report.claimed = jobs?.length ?? 0;

  for (const job of jobs ?? []) {
    if (Date.now() - started > budgetMs) {
      // Tiden er brugt – giv jobbet tilbage uden at bruge et forsøg.
      await update(job, {
        status: "pending",
        attempts: Math.max(0, job.attempts - 1),
        locked_at: null,
      });
      report.deferred++;
      continue;
    }
    const outcome = await processJob(job, origin);
    report[outcome]++;
  }
  return report;
}

async function update(job: Job, patch: Partial<Job>) {
  const { error } = await supabaseAdmin.from("message_jobs").update(patch).eq("id", job.id);
  if (error) console.error("message_jobs update", job.id, error.message);
}

async function processJob(
  job: Job,
  origin: string,
): Promise<"sent" | "retried" | "failed" | "cancelled" | "waiting"> {
  try {
    const ctx = job.booking_id ? await loadContext(job.booking_id, origin) : null;
    if (!ctx) {
      await update(job, { status: "cancelled", last_error: "Bookingen findes ikke længere." });
      return "cancelled";
    }
    const { booking, data } = ctx;

    if (job.template === "booking_reminder") {
      const stale =
        booking.status !== "confirmed" ||
        new Date(booking.starts_at) <= new Date() ||
        !job.dedupe_key.endsWith(String(Math.floor(new Date(booking.starts_at).getTime() / 1000)));
      if (stale) {
        await update(job, {
          status: "cancelled",
          last_error: "Påmindelse ikke længere relevant (flyttet, aflyst eller overstået).",
        });
        return "cancelled";
      }
    }

    let providerMessageId: string | undefined;
    if (job.channel === "email") {
      if (!job.recipient) throw new PermanentSendError("Ingen mailadresse.");
      const content =
        job.recipient_kind === "customer"
          ? customerEmail(job.template, data)
          : staffEmail(job.template, data);
      const r = await sendEmail({
        to: job.recipient,
        subject: content.subject,
        html: renderEmailHtml(content),
        text: renderEmailText(content),
        idempotencyKey: job.id,
      });
      providerMessageId = r.providerMessageId;
    } else if (job.channel === "whatsapp") {
      if (!job.recipient) throw new PermanentSendError("Intet telefonnummer.");
      const templateName = WHATSAPP_TEMPLATES[job.template];
      if (!templateName)
        throw new PermanentSendError(`Ingen WhatsApp-skabelon til ${job.template}.`);
      const r = await sendWhatsApp({
        to: toWhatsAppRecipient(job.recipient),
        templateName,
        params: whatsappParams(data),
        idempotencyKey: job.id,
      });
      providerMessageId = r.providerMessageId;
    } else if (job.channel === "push") {
      if (!job.recipient_staff_id) throw new PermanentSendError("Ingen modtager.");
      await sendPushToStaff(job.recipient_staff_id, pushContent(job.template, data));
    } else {
      // SMS er forberedt i datamodellen, men ikke aktiveret i første version.
      throw new PermanentSendError("SMS er ikke aktiveret.");
    }

    await update(job, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: providerMessageId ?? null,
      last_error: null,
      locked_at: null,
    });
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof ChannelNotConfigured) {
      await update(job, {
        status: "pending",
        attempts: Math.max(0, job.attempts - 1),
        scheduled_for: new Date(Date.now() + NOT_CONFIGURED_RETRY_MIN * 60_000).toISOString(),
        last_error: `Afventer opsætning: ${message}`,
        locked_at: null,
      });
      return "waiting";
    }
    if (err instanceof PermanentSendError) {
      // "Ingen pushabonnementer" er ikke en fejl – medarbejderen har bare ikke slået push til.
      const noSubs = job.channel === "push";
      await update(job, {
        status: noSubs ? "cancelled" : "failed",
        failed_at: noSubs ? null : new Date().toISOString(),
        last_error: message,
        locked_at: null,
      });
      return noSubs ? "cancelled" : "failed";
    }
    if (job.attempts >= job.max_attempts) {
      await update(job, {
        status: "failed",
        failed_at: new Date().toISOString(),
        last_error: message,
        locked_at: null,
      });
      return "failed";
    }
    const backoffMin = Math.min(60, 2 ** job.attempts); // 2, 4, 8, 16 … maks. 60 min
    await update(job, {
      status: "pending",
      scheduled_for: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      last_error: message,
      locked_at: null,
    });
    return "retried";
  }
}

async function loadContext(
  bookingId: string,
  origin: string,
): Promise<{ booking: Tables<"bookings">; data: MessageData } | null> {
  const [{ data: booking }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("*, staff:staff_id(display_name)")
      .eq("id", bookingId)
      .maybeSingle(),
    supabaseAdmin.from("salon_settings").select("*").eq("id", 1).single(),
  ]);
  if (!booking || !settings) return null;
  const token =
    booking.customer_email || booking.whatsapp_opt_in ? await bookingLinkToken(booking.id) : null;
  return {
    booking,
    data: {
      customerName: booking.customer_name,
      treatmentName: booking.treatment_name,
      staffName: booking.staff?.display_name ?? "",
      startsAt: new Date(booking.starts_at),
      durationMinutes: booking.duration_minutes,
      priceOre: booking.price_ore,
      salonName: settings.name,
      salonAddress: settings.address_line,
      salonPhone: settings.phone,
      cutoffHours: settings.cancellation_cutoff_hours,
      manageUrl: token && booking.status !== "cancelled" ? `${origin}/booking/${token}` : null,
      staffUrl: `${origin}/app/booking/${booking.id}`,
    },
  };
}
