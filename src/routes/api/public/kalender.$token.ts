import { createFileRoute } from "@tanstack/react-router";

import { tokenSchema } from "@/lib/booking-schemas";
import { buildIcs } from "@/lib/ics";

const ADDRESS = "Florian Studios, Toggangen 1, 2730 Herlev";

/**
 * "Tilføj til kalender" fra kundens link. text/calendar + inline gør, at iPhone (Safari) åbner
 * sit eget "Føj til kalender"-ark direkte – en download fra browseren ender i Filer i stedet.
 */
export const Route = createFileRoute("/api/public/kalender/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const notFound = () =>
          new Response("Bookingen findes ikke.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        const parsed = tokenSchema.safeParse({ token: params.token });
        if (!parsed.success) return notFound();
        const { getCalendarBooking } = await import("@/server/public-booking.server");
        const b = await getCalendarBooking(parsed.data.token);
        if (!b) return notFound();
        const origin = new URL(request.url).origin;
        const start = new Date(b.startsAt);
        const end = new Date(start.getTime() + b.durationMinutes * 60_000);
        const manage = `${origin}/booking/${parsed.data.token}`;
        const ics = buildIcs({
          uid: b.id,
          title: `${b.treatmentName} hos Florian Studios`,
          start,
          end,
          location: ADDRESS,
          description: `${b.treatmentName} hos ${b.staffName}. Ændr eller aflys: ${manage}`,
          url: manage,
          cancelled: b.status === "cancelled",
          alarmMinutes: 60,
        });
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="florian-studios.ics"',
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
