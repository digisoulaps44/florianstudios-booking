/**
 * Telefonnumre gemmes i E.164 ("+4512345678"). Danske numre kan skrives med eller uden +45,
 * mellemrum og bindestreger. Udenlandske numre skal starte med + og landekode.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s\-().]/g, "");
  if (/^\d{8}$/.test(raw)) return `+45${raw}`;
  if (/^0045\d{8}$/.test(raw)) return `+${raw.slice(2)}`;
  if (/^\+45\d{8}$/.test(raw)) return raw;
  if (/^\+[1-9]\d{7,14}$/.test(raw) && !raw.startsWith("+45")) return raw;
  return null;
}

/** WhatsApp-modtager: kun cifre med landekode, uden "+" (jf. Lovables WhatsApp-connector). */
export function toWhatsAppRecipient(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** "+4512345678" → "+45 12 34 56 78" */
export function formatPhone(e164: string): string {
  const m = /^\+45(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+45 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
