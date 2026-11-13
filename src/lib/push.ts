/**
 * Web push i browseren. Tilladelse bedes der først om efter et aktivt klik ("Slå notifikationer
 * til"). På iPhone virker push kun, når appen er føjet til hjemmeskærmen (iOS 16.4+).
 */
import { supabase } from "@/integrations/supabase/client";

export type PushState =
  | { kind: "unsupported" }
  | { kind: "ios-needs-install" }
  | { kind: "not-configured" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" };

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
  );
}

export async function pushState(vapidPublicKey: string | null): Promise<PushState> {
  if (isIos() && !isStandalone()) return { kind: "ios-needs-install" };
  if (!supported()) return { kind: "unsupported" };
  if (!vapidPublicKey) return { kind: "not-configured" };
  if (Notification.permission === "denied") return { kind: "denied" };
  const sub = await (await registration()).pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? { kind: "on" } : { kind: "off" };
}

export async function enablePush(vapidPublicKey: string, userId: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { kind: permission === "denied" ? "denied" : "off" };
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      expired_at: null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
  return { kind: "on" };
}

export async function disablePush(): Promise<PushState> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return { kind: "off" };
}
