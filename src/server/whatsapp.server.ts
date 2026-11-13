/**
 * WhatsApp via Lovables WhatsApp Business-connector.
 *
 * AFVENTER OPSÆTNING: Connectoren forbindes af ejeren (Meta Embedded Signup), skabelonerne i
 * docs/whatsapp-skabeloner.md oprettes og godkendes via Lovable, og Lovable bygger den rigtige
 * afsendelse her (samme signatur) samt modtageren af leveringsstatus. Lovables docs beskriver ikke
 * gatewayens URL eller headers, så de opfindes ikke her. Indtil da venter WhatsApp-jobs i køen,
 * og kunden får stadig mail.
 */
import { ChannelNotConfigured } from "./messages/errors";
import type { SendResult, WhatsAppMessage } from "./messages/channels.server";

export async function sendWhatsAppTemplate(_msg: WhatsAppMessage): Promise<SendResult> {
  throw new ChannelNotConfigured("WhatsApp Business er ikke forbundet endnu.");
}
