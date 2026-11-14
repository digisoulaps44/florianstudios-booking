/**
 * Den offentlige adresse, links i mails, WhatsApp, push og invitationer bygges på.
 * Sæt secret'en PUBLIC_APP_URL (fx https://book.florianstudio.dk), når domænet virker. Indtil da
 * – eller hvis værdien er ugyldig – bruges adressen, kaldet kom ind på, så intet går i stykker.
 */
export function publicOrigin(fallback: string, configured = process.env["PUBLIC_APP_URL"]): string {
  const raw = configured?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}
