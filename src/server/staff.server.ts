/**
 * Medarbejder- og ejerhandlinger. Hver funktion får brugerens egen Supabase-klient (RLS) fra
 * requireSupabaseAuth og tjekker adgangen med den, FØR den kalder databasefunktionerne med
 * server-nøglen. En medarbejder kan derfor kun ændre bookinger, RLS lader vedkommende se –
 * dvs. egne bookinger; ejeren ser alle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { localDate } from "@/lib/tz";
import type {
  inviteStaffSchema,
  retryMessageSchema,
  setStaffActiveSchema,
  staffCancelSchema,
  staffCreateBookingSchema,
  staffRescheduleSchema,
  staffSetStatusSchema,
} from "@/lib/staff-schemas";

import { loadBookableStaffTreatment, loadSettings, slotsForDays } from "./availability.server";
import { ensureBookingToken, fail, type Failure } from "./public-booking.server";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export type Me = {
  userId: string;
  staffId: string | null;
  displayName: string | null;
  isOwner: boolean;
};

export async function whoAmI(ctx: Ctx): Promise<Me> {
  const [staff, owner] = await Promise.all([
    ctx.supabase
      .from("staff")
      .select("id, display_name, active")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase.rpc("is_owner"),
  ]);
  const active = staff.data?.active ? staff.data : null;
  return {
    userId: ctx.userId,
    staffId: active?.id ?? null,
    displayName: active?.display_name ?? null,
    isOwner: owner.data === true,
  };
}

async function actorFor(ctx: Ctx): Promise<{ me: Me; actor: "owner" | "staff" } | null> {
  const me = await whoAmI(ctx);
  if (!me.staffId && !me.isOwner) return null;
  return { me, actor: me.isOwner ? "owner" : "staff" };
}

function errorCode(error: { code?: string; message?: string } | null): Failure | null {
  if (!error) return null;
  if (error.code === "23P01")
    return fail("slot_taken", "Tiden overlapper en anden booking hos medarbejderen.");
  const m = error.message ?? "";
  if (m.includes("booking_not_active")) return fail("booking_not_active");
  if (m.includes("treatment_unavailable")) return fail("treatment_unavailable");
  if (m.includes("booking_not_found")) return fail("not_found", "Bookingen findes ikke.");
  return null;
}

/** RLS-tjek: kan brugeren se bookingen? (egen booking eller ejer) */
async function visibleBooking(ctx: Ctx, bookingId: string) {
  const { data } = await ctx.supabase
    .from("bookings")
    .select("id, staff_id, staff_treatment_id, starts_at, status")
    .eq("id", bookingId)
    .maybeSingle();
  return data;
}

/** Medarbejdere må kun bruge egne behandlinger; ejeren alle. */
async function allowedStaffTreatment(ctx: Ctx, me: Me, staffTreatmentId: string) {
  const st = await loadBookableStaffTreatment(staffTreatmentId);
  if (!st) return null;
  if (!me.isOwner && st.staff_id !== me.staffId) return null;
  return st;
}

async function withinSchedule(
  st: NonNullable<Awaited<ReturnType<typeof loadBookableStaffTreatment>>>,
  startsAt: Date,
  excludeBookingId?: string,
) {
  const settings = await loadSettings();
  const date = localDate(startsAt);
  const map = await slotsForDays(st, [date], settings, { excludeBookingId, ignoreNotice: true });
  const slots = map.get(date)?.slots ?? [];
  return slots.some((s) => s.getTime() === startsAt.getTime());
}

export async function staffCreateBooking(
  ctx: Ctx,
  input: z.output<typeof staffCreateBookingSchema>,
) {
  const a = await actorFor(ctx);
  if (!a) return fail("not_found", "Du har ikke adgang.");
  const st = await allowedStaffTreatment(ctx, a.me, input.staffTreatmentId);
  if (!st) return fail("treatment_unavailable", "Behandlingen kan ikke bruges.");
  const startsAt = new Date(input.startsAt);
  if (!input.ignoreSchedule && !(await withinSchedule(st, startsAt))) {
    return fail(
      "slot_unavailable",
      "Tiden ligger uden for arbejdstid eller er optaget. Slå “Book uden for arbejdstid” til for at gennemtvinge.",
    );
  }
  const { data, error } = await supabaseAdmin.rpc("create_booking", {
    p_staff_treatment_id: st.id,
    p_starts_at: startsAt.toISOString(),
    p_customer_name: input.customer.name,
    p_customer_phone: input.customer.phone,
    p_customer_email: (input.customer.email || null) as unknown as string,
    p_whatsapp_opt_in: input.customer.whatsappOptIn,
    p_note: (input.note || null) as unknown as string,
    p_source: "staff",
    p_idempotency_key: input.idempotencyKey,
    p_token_hash: null as unknown as string,
    p_token_expires_at: null as unknown as string,
    p_actor: a.actor,
    p_actor_user_id: ctx.userId,
  });
  const f = errorCode(error);
  if (f) return f;
  if (error || !data?.[0]) throw new Error(`create_booking: ${error?.message}`);
  await ensureBookingToken(data[0].booking_id, startsAt);
  return { ok: true as const, bookingId: data[0].booking_id };
}

export async function staffReschedule(ctx: Ctx, input: z.output<typeof staffRescheduleSchema>) {
  const a = await actorFor(ctx);
  if (!a) return fail("not_found", "Du har ikke adgang.");
  const b = await visibleBooking(ctx, input.bookingId);
  if (!b) return fail("not_found", "Bookingen findes ikke.");
  const stId = input.staffTreatmentId ?? b.staff_treatment_id;
  if (!stId)
    return fail("treatment_unavailable", "Behandlingen findes ikke længere. Opret en ny booking.");
  const st = await allowedStaffTreatment(ctx, a.me, stId);
  if (!st) return fail("treatment_unavailable", "Behandlingen kan ikke bruges.");
  const startsAt = new Date(input.startsAt);
  if (!input.ignoreSchedule && !(await withinSchedule(st, startsAt, b.id))) {
    return fail("slot_unavailable", "Tiden ligger uden for arbejdstid eller er optaget.");
  }
  const { error } = await supabaseAdmin.rpc("reschedule_booking", {
    p_booking_id: b.id,
    p_new_starts_at: startsAt.toISOString(),
    p_new_staff_treatment_id: (input.staffTreatmentId ?? null) as unknown as string,
    p_actor: a.actor,
    p_actor_user_id: ctx.userId,
  });
  const f = errorCode(error);
  if (f) return f;
  if (error) throw new Error(error.message);
  await ensureBookingToken(b.id, startsAt);
  await supabaseAdmin
    .from("booking_tokens")
    .update({ expires_at: new Date(startsAt.getTime() + 24 * 3600_000).toISOString() })
    .eq("booking_id", b.id);
  return { ok: true as const };
}

export async function staffCancel(ctx: Ctx, input: z.output<typeof staffCancelSchema>) {
  const a = await actorFor(ctx);
  if (!a) return fail("not_found", "Du har ikke adgang.");
  const b = await visibleBooking(ctx, input.bookingId);
  if (!b) return fail("not_found", "Bookingen findes ikke.");
  const { error } = await supabaseAdmin.rpc("cancel_booking", {
    p_booking_id: b.id,
    p_actor: a.actor,
    p_actor_user_id: ctx.userId,
    p_reason: (input.reason || null) as unknown as string,
  });
  const f = errorCode(error);
  if (f) return f;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function staffSetStatus(ctx: Ctx, input: z.output<typeof staffSetStatusSchema>) {
  const a = await actorFor(ctx);
  if (!a) return fail("not_found", "Du har ikke adgang.");
  const b = await visibleBooking(ctx, input.bookingId);
  if (!b) return fail("not_found", "Bookingen findes ikke.");
  const { error } = await supabaseAdmin.rpc("set_booking_status", {
    p_booking_id: b.id,
    p_status: input.status,
    p_actor: a.actor,
    p_actor_user_id: ctx.userId,
  });
  const f = errorCode(error);
  if (f) return f;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

// ── Ejer ─────────────────────────────────────────────────────────────────
async function requireOwner(ctx: Ctx): Promise<Me | null> {
  const me = await whoAmI(ctx);
  return me.isOwner ? me : null;
}

export async function inviteStaff(
  ctx: Ctx,
  input: z.output<typeof inviteStaffSchema>,
  origin: string,
) {
  if (!(await requireOwner(ctx))) return fail("not_found", "Kun ejeren kan invitere medarbejdere.");
  const email = input.email.toLowerCase();
  // Opret profilen først (RLS: kun ejeren må indsætte). Trigger kobler kontoen på ved første login.
  const { data: existing } = await ctx.supabase
    .from("staff")
    .select("id, user_id")
    .ilike("email", email)
    .maybeSingle();
  if (!existing) {
    const { error } = await ctx.supabase
      .from("staff")
      .insert({ display_name: input.displayName, email, phone: input.phone || null });
    if (error) return fail("invalid", `Medarbejderen kunne ikke oprettes: ${error.message}`);
  } else if (existing.user_id) {
    return fail("invalid", "Medarbejderen har allerede en konto.");
  }
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/login?velkommen=1`,
  });
  if (inviteError) return fail("invalid", `Invitationen kunne ikke sendes: ${inviteError.message}`);
  return { ok: true as const };
}

export async function setStaffActive(ctx: Ctx, input: z.output<typeof setStaffActiveSchema>) {
  const me = await requireOwner(ctx);
  if (!me) return fail("not_found", "Kun ejeren kan deaktivere medarbejdere.");
  if (input.staffId === me.staffId && !input.active)
    return fail("invalid", "Du kan ikke deaktivere dig selv.");
  const { data: staff, error } = await ctx.supabase
    .from("staff")
    .update({ active: input.active })
    .eq("id", input.staffId)
    .select("user_id")
    .single();
  if (error) return fail("invalid", error.message);
  if (staff.user_id) {
    // Spær/åbn login. Eksisterende bookinger røres ikke – de vises som konflikter.
    await supabaseAdmin.auth.admin.updateUserById(staff.user_id, {
      ban_duration: input.active ? "none" : "876000h",
    });
  }
  return { ok: true as const };
}

export async function retryMessage(ctx: Ctx, input: z.output<typeof retryMessageSchema>) {
  if (!(await requireOwner(ctx))) return fail("not_found", "Kun ejeren kan sende beskeder igen.");
  const { data: job } = await ctx.supabase
    .from("message_jobs")
    .select("id, status")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return fail("not_found", "Beskeden findes ikke.");
  if (job.status !== "failed") return fail("invalid", "Kun fejlede beskeder kan sendes igen.");
  const { error } = await supabaseAdmin
    .from("message_jobs")
    .update({
      status: "pending",
      attempts: 0,
      scheduled_for: new Date().toISOString(),
      last_error: null,
      failed_at: null,
    })
    .eq("id", job.id)
    .eq("status", "failed");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
