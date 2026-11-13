/**
 * Afsendelseskanaler. Push er implementeret her (VAPID/RFC 8291). Mail og WhatsApp går gennem
 * Lovables egne integrationer, som sættes op via Lovable (jf. AGENTS.md og Lovables docs) –
 * indtil da kaster de ChannelNotConfigured, og jobbet venter i stedet for at fejle.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { ChannelNotConfigured, PermanentSendError } from "./errors";
import { sendWebPush } from "./webpush";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};
export type WhatsAppMessage = {
  to: string;
  templateName: string;
  params: string[];
  idempotencyKey: string;
};
export type SendResult = { providerMessageId?: string | undefined };

/** Mail via Lovable Email. Implementeringen leveres af Lovable i src/server/email.server.ts. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const mod = await import("@/server/email.server");
  return mod.sendAppEmail(msg);
}

/** WhatsApp via Lovables WhatsApp Business-connector. Implementeringen leveres af Lovable i src/server/whatsapp.server.ts. */
export async function sendWhatsApp(msg: WhatsAppMessage): Promise<SendResult> {
  const mod = await import("@/server/whatsapp.server");
  return mod.sendWhatsAppTemplate(msg);
}

function vapidKeys() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"];
  if (!publicKey || !privateKey || !subject)
    throw new ChannelNotConfigured(
      "Push mangler VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY og VAPID_SUBJECT.",
    );
  return { publicKey, privateKey, subject };
}

/** Push til alle aktive enheder for én medarbejder. Udløbne abonnementer markeres og springes over. */
export async function sendPushToStaff(
  staffId: string,
  message: { title: string; body: string; url: string },
): Promise<SendResult & { delivered: number }> {
  const keys = vapidKeys();
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("user_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff?.user_id) throw new PermanentSendError("Medarbejderen har ingen konto.");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", staff.user_id)
    .is("expired_at", null);
  if (error) throw new Error(error.message);
  if (!subs || subs.length === 0) throw new PermanentSendError("Ingen aktive pushabonnementer.");

  let delivered = 0;
  const errors: string[] = [];
  for (const s of subs) {
    const r = await sendWebPush(s, message, keys);
    if (r.ok) {
      delivered++;
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .eq("id", s.id);
    } else if (r.gone) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ expired_at: new Date().toISOString() })
        .eq("id", s.id);
    } else {
      errors.push(`${r.status} ${r.message}`);
    }
  }
  if (delivered === 0) {
    if (errors.length === 0) throw new PermanentSendError("Alle pushabonnementer er udløbet.");
    throw new Error(`Push fejlede: ${errors.join("; ")}`);
  }
  return { delivered };
}
