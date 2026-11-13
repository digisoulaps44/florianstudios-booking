import { describe, expect, it } from "vitest";

import { b64urlToBytes, bytesToB64url, encryptPayload, vapidAuthorization } from "./webpush";

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
      key,
      length * 8,
    ),
  );
}

/** Dekrypterer som en browser (brugeragent) ville – uafhængigt af encryptPayload. */
async function decryptAsUserAgent(
  body: Uint8Array,
  ua: CryptoKeyPair,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: asKey } as EcdhKeyDeriveParams,
      ua.privateKey,
      256,
    ),
  );
  const keyInfo = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "decrypt",
  ]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      key,
      ciphertext as BufferSource,
    ),
  );
  return { rs, idlen, plain };
}

describe("web push (RFC 8291 / 8292)", () => {
  it("krypterer så brugeragenten kan dekryptere (aes128gcm, én record)", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const message = JSON.stringify({ title: "Ny booking", body: "Mads Hansen · Herreklip" });

    const body = await encryptPayload(
      enc.encode(message),
      bytesToB64url(uaPublic),
      bytesToB64url(authSecret),
    );
    const { rs, idlen, plain } = await decryptAsUserAgent(body, ua, uaPublic, authSecret);

    expect(rs).toBe(4096);
    expect(idlen).toBe(65);
    expect(plain[plain.length - 1]).toBe(2); // sidste-record-markør
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(message);
  });

  it("laver en gyldig ES256 VAPID-JWT for endpointets origin", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", {
      publicKey: bytesToB64url(pub),
      privateKey: jwk.d!,
      subject: "mailto:test@example.com",
    });
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(m![2]!)));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:test@example.com");
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      b64urlToBytes(m![3]!) as BufferSource,
      enc.encode(`${m![1]}.${m![2]}`),
    );
    expect(ok).toBe(true);
  });
});
