import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button, Notice, Spinner } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { formatDateShort, formatTime } from "@/lib/format";
import { useFailedMessages, useMe } from "@/lib/staff-data";
import { retryFailedMessage } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/beskeder")({ component: FailedMessages });

const CHANNEL: Record<string, string> = {
  email: "Mail",
  whatsapp: "WhatsApp",
  push: "Push",
  sms: "SMS",
};
const TEMPLATE: Record<string, string> = {
  booking_confirmed: "Bekræftelse",
  booking_changed: "Ændring",
  booking_cancelled: "Aflysning",
  booking_reminder: "Påmindelse",
  staff_booking_confirmed: "Ny booking (medarbejder)",
  staff_booking_changed: "Flyttet (medarbejder)",
  staff_booking_cancelled: "Aflyst (medarbejder)",
};

function FailedMessages() {
  const me = useMe();
  const qc = useQueryClient();
  const jobs = useFailedMessages(me.isOwner);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  if (!me.isOwner) return <Notice tone="error" title="Kun ejeren har adgang til beskedloggen." />;

  const retry = async (id: string) => {
    const r = await retryFailedMessage({ data: { jobId: id } });
    setMsg(
      r.ok
        ? { tone: "success", text: "Beskeden sendes igen inden for et minut." }
        : { tone: "error", text: r.message },
    );
    await qc.invalidateQueries({ queryKey: ["failed-messages"] });
  };

  return (
    <>
      <PageHeader eyebrow="Ejer" title="Fejlede beskeder." />
      <div className="grid max-w-text gap-6">
        <p className="text-sm text-text-2">
          Bookinger er gyldige, selv om en besked fejler. Her ser du mails, WhatsApp-beskeder og
          push, der ikke kom frem efter flere forsøg.
        </p>
        {msg ? <Notice tone={msg.tone} title={msg.text} live /> : null}
        {jobs.isPending ? (
          <Spinner />
        ) : (jobs.data ?? []).length === 0 ? (
          <p className="border border-dashed border-line-strong p-6 text-text-2">
            Ingen fejlede beskeder.
          </p>
        ) : (
          <ul className="border-y border-line">
            {jobs.data!.map((j, i) => (
              <li key={j.id} className={cn("grid gap-2 py-4", i > 0 && "border-t border-line")}>
                <p className="text-base font-medium text-text">
                  {CHANNEL[j.channel]} · {TEMPLATE[j.template] ?? j.template}
                </p>
                <p className="text-sm text-text-2">
                  {j.failed_at
                    ? `${formatDateShort(new Date(j.failed_at))} ${formatTime(new Date(j.failed_at))} · `
                    : ""}
                  {j.attempts} forsøg{j.last_error ? ` · ${j.last_error}` : ""}
                </p>
                <div className="flex flex-wrap gap-x-6">
                  <Button variant="secondary" size="sm" onClick={() => retry(j.id)}>
                    Send igen
                  </Button>
                  {j.booking_id ? (
                    <Link
                      to="/app/booking/$id"
                      params={{ id: j.booking_id }}
                      className="inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.18em] text-text-2 underline-offset-4 hover:text-text hover:underline"
                    >
                      Se booking
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
