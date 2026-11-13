/**
 * Mail via Lovable Email.
 *
 * AFVENTER OPSÆTNING: Lovable Email aktiveres ved at bede Lovable om det (Lovables docs:
 * "Lovable sends app emails from your app's server code"), og afsenderdomænet sættes op under
 * More → Emails. Lovable erstatter denne funktion med den rigtige afsendelse – samme signatur.
 * Indtil da venter mailjobs i køen (de fejler ikke).
 */
import { ChannelNotConfigured } from "./messages/errors";
import type { EmailMessage, SendResult } from "./messages/channels.server";

export async function sendAppEmail(_msg: EmailMessage): Promise<SendResult> {
  throw new ChannelNotConfigured("Lovable Email er ikke sat op endnu.");
}
