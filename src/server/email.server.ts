/**
 * Mail via Lovable Email.
 *
 * Sender allerede renderede bookingbeskeder. Ikke-verificeret domæne lader jobs vente.
 */
import { sendRenderedAppEmail } from "@/lib/email-templates/send-email";
import type { EmailMessage, SendResult } from "./messages/channels.server";

export async function sendAppEmail(msg: EmailMessage): Promise<SendResult> {
  return sendRenderedAppEmail(msg);
}
