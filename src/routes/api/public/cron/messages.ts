import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Lovable Cron kalder denne route hver halve time til påmindelser og genforsøg.
 * Nye bekræftelser sendes direkte efter bookingcommit. Alle kald kræver den administrerede cron-godkendelse.
 */
export const Route = createFileRoute("/api/public/cron/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) {
          // Safe version signal: verify the published handler without running live jobs.
          const headers = new Headers(denied.headers);
          headers.set("X-Booking-Dispatch", "event-v1");
          return new Response(denied.body, { status: denied.status, headers });
        }
        const { runMessageWorker } = await import("@/server/messages/worker.server");
        const { publicOrigin } = await import("@/server/public-url");
        // Links i beskeder bygges på den faste offentlige adresse (PUBLIC_APP_URL), ikke cron-kaldets.
        const origin = publicOrigin(new URL(request.url).origin);
        try {
          const report = await runMessageWorker(origin, 6000);
          return Response.json(
            { ok: true, ...report },
            { headers: { "X-Booking-Dispatch": "event-v1" } },
          );
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
