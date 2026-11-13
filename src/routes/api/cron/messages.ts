import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Lovable Cron kalder denne route hvert minut (POST, Authorization: Bearer LOVABLE_CRON_SECRET).
 * Kaldet skal svare hurtigt, så arbejderen har et tidsbudget og efterlader resten til næste minut.
 */
export const Route = createFileRoute("/api/cron/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runMessageWorker } = await import("@/server/messages/worker.server");
        const origin = new URL(request.url).origin;
        try {
          const report = await runMessageWorker(origin, 6000);
          return Response.json({ ok: true, ...report });
        } catch (err) {
          console.error("message worker", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "unknown" },
            { status: 500 },
          );
        }
      },
    },
  },
});
