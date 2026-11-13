import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Den offentlige VAPID-nøgle, browseren skal bruge for at abonnere på push (null = ikke sat op). */
export const fetchPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ vapidPublicKey: process.env["VAPID_PUBLIC_KEY"] ?? null }));
