/**
 * Kundens sikre link (/booking/<token>).
 *
 * Tokenet er HMAC-SHA256(hemmelighed, "booking-link:v1:<bookingId>") – uforudsigeligt uden
 * hemmeligheden, så kun modtageren af bekræftelsen kan åbne bookingen. Databasen gemmer kun
 * SHA-256 af tokenet (booking_tokens.token_hash) til opslag; beskedarbejderen kan danne det
 * samme link igen til mails, uden at selve tokenet nogensinde ligger i databasen.
 *
 * Hemmelighed: BOOKING_LINK_SECRET (Lovable Secrets). Mangler den, afledes en domæneadskilt
 * nøgle af SUPABASE_SERVICE_ROLE_KEY, så links virker fra første dag. Bemærk: skiftes den
 * nøgle, holder eksisterende links op med at virke.
 */
import { hashToken } from "@/lib/token";

function secretMaterial(): string {
  const dedicated = process.env["BOOKING_LINK_SECRET"];
  if (dedicated && dedicated.length >= 32) return `dedicated:${dedicated}`;
  const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (service) return `derived:${service}`;
  throw new Error("Mangler BOOKING_LINK_SECRET (og SUPABASE_SERVICE_ROLE_KEY) til bookinglinks.");
}

let keyPromise: Promise<CryptoKey> | undefined;
function hmacKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise;
}

function base64Url(buffer: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buffer)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function bookingLinkToken(bookingId: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(`booking-link:v1:${bookingId}`),
  );
  return base64Url(sig);
}

export async function bookingLinkTokenHash(bookingId: string): Promise<string> {
  return hashToken(await bookingLinkToken(bookingId));
}

export function bookingLinkPath(token: string): string {
  return `/booking/${token}`;
}
