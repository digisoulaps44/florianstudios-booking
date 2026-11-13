import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { useCallback, useState } from "react";

import { SummaryList } from "@/components/fs/booking";
import {
  Button,
  Notice,
  Spinner,
  StatusBadge,
  buttonClasses,
  type BookingStatus,
} from "@/components/fs/primitives";
import { StaffSlotPicker, type PickedTime } from "@/components/fs/slot-picker";
import { PageHeader } from "@/components/fs/staff";
import { formatDateShort, formatDuration, formatPrice, formatTime, formatWhen } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useBooking, useMe } from "@/lib/staff-data";
import {
  cancelStaffBooking,
  rescheduleStaffBooking,
  setBookingStatus,
} from "@/lib/staff.functions";
import { localDate, localTime } from "@/lib/tz";

export const Route = createFileRoute("/app/booking/$id")({ component: BookingDetail });

const EVENT_LABEL: Record<string, string> = {
  created: "Oprettet",
  rescheduled: "Flyttet",
  cancelled: "Aflyst",
  status_changed: "Status ændret",
};
const ACTOR_LABEL: Record<string, string> = {
  customer: "kunden",
  staff: "medarbejder",
  owner: "ejer",
  system: "systemet",
};
const CHANNEL_LABEL: Record<string, string> = {
  email: "Mail",
  whatsapp: "WhatsApp",
  push: "Push",
  sms: "SMS",
};
const JOB_STATUS: Record<string, string> = {
  pending: "Venter",
  processing: "Sendes",
  sent: "Sendt",
  delivered: "Leveret",
  read: "Læst",
  failed: "Fejlet",
  cancelled: "Annulleret",
};

function BookingDetail() {
  const { id } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const q = useBooking(id);
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [picked, setPicked] = useState<PickedTime>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const onPicked = useCallback((p: PickedTime) => setPicked(p), []);

  if (q.isPending) return <Spinner label="Henter booking …" />;
  if (q.isError || !q.data.booking)
    return <Notice tone="error" title="Bookingen findes ikke, eller du har ikke adgang." />;

  const b = q.data.booking;
  const start = new Date(b.starts_at);
  const refresh = async (text: string) => {
    setMode("view");
    setMessage({ tone: "success", text });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["booking", id] }),
      qc.invalidateQueries({ queryKey: ["bookings"] }),
    ]);
  };
  const run = async (
    fn: () => Promise<{ ok: true } | { ok: false; message: string }>,
    success: string,
  ) => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await fn();
      if (r.ok) await refresh(success);
      else setMessage({ tone: "error", text: r.message });
    } catch {
      setMessage({ tone: "error", text: "Handlingen kunne ikke gennemføres. Prøv igen." });
    } finally {
      setBusy(false);
    }
  };

  const active = b.status === "confirmed";

  return (
    <>
      <PageHeader
        eyebrow={formatWhen(start)}
        title={b.customer_name}
        actions={<StatusBadge status={b.status as BookingStatus} />}
      />

      <div className="grid max-w-text gap-8">
        {message ? <Notice tone={message.tone} title={message.text} live /> : null}

        <div className="flex flex-wrap gap-3">
          <a href={`tel:${b.customer_phone}`} className={buttonClasses("secondary", "sm")}>
            <Phone aria-hidden="true" className="h-4 w-4" />
            Ring
          </a>
          {b.customer_email ? (
            <a href={`mailto:${b.customer_email}`} className={buttonClasses("secondary", "sm")}>
              <Mail aria-hidden="true" className="h-4 w-4" />
              Mail
            </a>
          ) : null}
        </div>

        <SummaryList
          rows={[
            {
              term: "Behandling",
              value: `${b.treatment_name} · ${formatDuration(b.duration_minutes)}${b.buffer_minutes ? ` + ${b.buffer_minutes} min buffer` : ""}`,
            },
            { term: "Medarbejder", value: b.staff?.display_name ?? "" },
            { term: "Tidspunkt", value: `${formatWhen(start)}–${formatTime(new Date(b.ends_at))}` },
            {
              term: "Kontakt",
              value: (
                <>
                  {formatPhone(b.customer_phone)}
                  {b.customer_email ? (
                    <>
                      <br />
                      {b.customer_email}
                    </>
                  ) : null}
                  {b.whatsapp_opt_in ? (
                    <>
                      <br />
                      <span className="inline-flex items-center gap-1.5 text-text-2">
                        <MessageCircle aria-hidden="true" className="h-4 w-4" />
                        WhatsApp tilvalgt{" "}
                        {b.whatsapp_opt_in_at
                          ? formatDateShort(new Date(b.whatsapp_opt_in_at))
                          : ""}
                      </span>
                    </>
                  ) : null}
                </>
              ),
            },
            ...(b.note ? [{ term: "Note", value: b.note }] : []),
            {
              term: "Kilde",
              value: b.source === "online" ? "Booket online" : "Oprettet af salonen",
            },
          ]}
          total={{ term: "Pris", value: formatPrice(b.price_ore) }}
        />

        {active && mode === "view" ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => setBookingStatus({ data: { bookingId: b.id, status: "completed" } }),
                    "Markeret som gennemført.",
                  )
                }
              >
                Gennemført
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => setBookingStatus({ data: { bookingId: b.id, status: "no_show" } }),
                    "Markeret som udeblevet.",
                  )
                }
              >
                Udeblevet
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6">
              <Button variant="ghost" onClick={() => setMode("move")}>
                Flyt tid
              </Button>
              <Button variant="ghost" onClick={() => setMode("cancel")}>
                Aflys booking
              </Button>
            </div>
          </div>
        ) : null}

        {(b.status === "completed" || b.status === "no_show") && mode === "view" ? (
          <Button
            variant="ghost"
            className="justify-self-start"
            disabled={busy}
            onClick={() =>
              run(
                () => setBookingStatus({ data: { bookingId: b.id, status: "confirmed" } }),
                "Status sat tilbage til bekræftet.",
              )
            }
          >
            Fortryd status
          </Button>
        ) : null}

        {mode === "move" ? (
          <section aria-label="Flyt tid" className="grid gap-6 border-t border-line pt-8">
            <h2 className="text-2xl leading-8 text-text">Flyt tid.</h2>
            <StaffSlotPicker
              staffTreatmentId={b.staff_treatment_id ?? undefined}
              initialDate={localDate(start)}
              initialTime={localTime(start)}
              excludeBookingId={b.id}
              onChange={onPicked}
            />
            <p className="text-sm text-text-2">
              Kunden får automatisk besked om den nye tid. Fejler flytningen, beholdes den
              oprindelige tid.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Button
                disabled={!picked || busy}
                aria-busy={busy || undefined}
                onClick={() =>
                  picked &&
                  run(
                    () =>
                      rescheduleStaffBooking({
                        data: {
                          bookingId: b.id,
                          startsAt: picked.startsAt,
                          ignoreSchedule: picked.ignoreSchedule,
                        },
                      }),
                    `Flyttet til ${formatWhen(new Date(picked.startsAt))}.`,
                  )
                }
              >
                {busy ? "Flytter …" : "Flyt booking"}
              </Button>
              <Button variant="ghost" onClick={() => setMode("view")}>
                Annullér
              </Button>
            </div>
          </section>
        ) : null}

        {mode === "cancel" ? (
          <section aria-label="Aflys" className="grid gap-4 border-t border-line pt-8">
            <h2 className="text-2xl leading-8 text-text">Aflys booking?</h2>
            <p className="text-base text-text-2">
              Kunden får besked på mail{b.whatsapp_opt_in ? " og WhatsApp" : ""}. Tiden bliver ledig
              igen.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => cancelStaffBooking({ data: { bookingId: b.id, reason: "" } }),
                    "Bookingen er aflyst.",
                  )
                }
              >
                {busy ? "Aflyser …" : "Ja, aflys"}
              </Button>
              <Button variant="ghost" onClick={() => setMode("view")}>
                Behold
              </Button>
            </div>
          </section>
        ) : null}

        <section aria-label="Historik" className="border-t border-line pt-8">
          <h2 className="text-xl leading-7 text-text">Historik</h2>
          <ol className="mt-4 grid gap-2">
            {q.data.events.map((e) => (
              <li key={e.id} className="tabular text-sm text-text-2">
                {formatDateShort(new Date(e.created_at))} {formatTime(new Date(e.created_at))} ·{" "}
                {EVENT_LABEL[e.event] ?? e.event} af {ACTOR_LABEL[e.actor] ?? e.actor}
              </li>
            ))}
          </ol>
        </section>

        {me.isOwner && q.data.jobs.length > 0 ? (
          <section aria-label="Beskeder" className="border-t border-line pt-8">
            <h2 className="text-xl leading-7 text-text">Beskeder</h2>
            <ul className="mt-4 grid gap-2">
              {q.data.jobs.map((j) => (
                <li
                  key={j.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-text">
                    {CHANNEL_LABEL[j.channel]} ·{" "}
                    {j.recipient_kind === "customer" ? "kunde" : "medarbejder"} · {j.template}
                  </span>
                  <span className={j.status === "failed" ? "text-closed" : "text-text-2"}>
                    {JOB_STATUS[j.status] ?? j.status}
                    {j.last_error && j.status === "failed" ? ` – ${j.last_error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
