import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { SummaryList } from "@/components/fs/booking";
import {
  Button,
  ButtonLink,
  Notice,
  Spinner,
  StatusBadge,
  TextField,
  buttonClasses,
  type BookingStatus,
} from "@/components/fs/primitives";
import { StaffSlotPicker, type PickedTime } from "@/components/fs/slot-picker";
import { PageHeader } from "@/components/fs/staff";
import { notifySuccess } from "@/lib/notify";
import { formatDateShort, formatDuration, formatPrice, formatTime, formatWhen } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useBooking, useMe } from "@/lib/staff-data";
import {
  cancelStaffBooking,
  rescheduleStaffBooking,
  setBookingStatus,
  updateBookingCustomer,
} from "@/lib/staff.functions";
import { staffUpdateCustomerSchema } from "@/lib/staff-schemas";
import { localDate, localTime } from "@/lib/tz";

export const Route = createFileRoute("/app/booking/$id")({
  // ?oprettet=true: kvittering lige efter "Opret booking" (fjernes fra adressen igen).
  validateSearch: z.object({ oprettet: z.boolean().optional() }),
  component: BookingDetail,
});

/** Hvordan kunden hører om ændringen – så medarbejderen ved, om der skal ringes. */
function customerChannel(b: { customer_email: string | null; whatsapp_opt_in: boolean }) {
  if (b.customer_email && b.whatsapp_opt_in) return "Kunden får besked på mail og WhatsApp.";
  if (b.customer_email) return "Kunden får besked på mail.";
  if (b.whatsapp_opt_in) return "Kunden får besked på WhatsApp.";
  return "Kunden har ingen mail – giv selv besked.";
}

const EVENT_LABEL: Record<string, string> = {
  created: "Oprettet",
  rescheduled: "Flyttet",
  cancelled: "Aflyst",
  status_changed: "Status ændret",
  details_changed: "Kundeoplysninger rettet",
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
const TEMPLATE_LABEL: Record<string, string> = {
  booking_confirmed: "Bekræftelse",
  booking_changed: "Ændring",
  booking_cancelled: "Aflysning",
  booking_reminder: "Påmindelse",
  staff_booking_confirmed: "Ny booking",
  staff_booking_changed: "Flyttet",
  staff_booking_cancelled: "Aflyst",
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

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Flyt fokus til overskriften, når "Flyt tid" eller "Aflys" åbnes – knappen, man trykkede på, forsvinder. */
function focusOnMount(el: HTMLElement | null) {
  el?.focus();
}

function BookingDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/booking/$id" });
  const [created] = useState(() => search.oprettet === true);
  useEffect(() => {
    if (search.oprettet) void navigate({ search: {}, replace: true });
  }, [search.oprettet, navigate]);
  const me = useMe();
  const qc = useQueryClient();
  const q = useBooking(id);
  const [mode, setMode] = useState<"view" | "move" | "cancel" | "edit">("view");
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
  const changeStatus = async (status: "completed" | "no_show" | "confirmed", label: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await setBookingStatus({ data: { bookingId: b.id, status } });
      if (!r.ok) {
        setMessage({ tone: "error", text: r.message });
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["booking", id] }),
        qc.invalidateQueries({ queryKey: ["bookings"] }),
      ]);
      notifySuccess(`${b.customer_name}: ${label}`, {
        action:
          status === "confirmed"
            ? undefined
            : {
                label: "Fortryd",
                onClick: () => void changeStatus("confirmed", "status sat tilbage til bekræftet"),
              },
      });
    } catch {
      setMessage({ tone: "error", text: "Status kunne ikke ændres. Prøv igen." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={formatWhen(start)}
        title={b.customer_name}
        actions={<StatusBadge status={b.status as BookingStatus} />}
      />

      <div className="grid max-w-text gap-8">
        {message ? <Notice tone={message.tone} title={message.text} live reveal /> : null}
        {created && !message ? (
          <Notice
            tone="success"
            live
            reveal
            title={`Booking oprettet: ${b.customer_name}, ${lowerFirst(formatWhen(start))}.`}
            actions={
              <>
                <ButtonLink to="/app/ny" variant="ghost" className="text-text">
                  Ny booking
                </ButtonLink>
                <ButtonLink to="/app" variant="ghost">
                  Til i dag
                </ButtonLink>
              </>
            }
          >
            {customerChannel(b)}
          </Notice>
        ) : null}

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
                aria-disabled={busy || undefined}
                onClick={() => void changeStatus("completed", "markeret som gennemført")}
              >
                Gennemført
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-disabled={busy || undefined}
                onClick={() => void changeStatus("no_show", "markeret som udeblevet")}
              >
                Udeblevet
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6">
              <Button variant="ghost" onClick={() => setMode("move")}>
                Flyt tid
              </Button>
              <Button variant="ghost" onClick={() => setMode("edit")}>
                Ret kunde
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
            aria-disabled={busy || undefined}
            onClick={() => void changeStatus("confirmed", "status sat tilbage til bekræftet")}
          >
            Fortryd status
          </Button>
        ) : null}

        {mode === "move" ? (
          <section aria-label="Flyt tid" className="rise-in grid gap-6 border-t border-line pt-8">
            <h2 ref={focusOnMount} tabIndex={-1} className="text-2xl leading-8 text-text">
              Flyt tid.
            </h2>
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
                disabled={!picked}
                loading={busy}
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
                    `Flyttet til ${lowerFirst(formatWhen(new Date(picked.startsAt)))}. ${customerChannel(b)}`,
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

        {mode === "edit" ? (
          <EditCustomer
            booking={b}
            busy={busy}
            onCancel={() => setMode("view")}
            onSave={(data) =>
              run(() => updateBookingCustomer({ data }), "Kundeoplysningerne er gemt.")
            }
          />
        ) : null}

        {mode === "cancel" ? (
          <section aria-label="Aflys" className="rise-in grid gap-4 border-t border-line pt-8">
            <h2 ref={focusOnMount} tabIndex={-1} className="text-2xl leading-8 text-text">
              Aflys booking?
            </h2>
            <p className="text-base text-text-2">
              Kunden får besked på mail{b.whatsapp_opt_in ? " og WhatsApp" : ""}. Tiden bliver ledig
              igen.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Button
                loading={busy}
                onClick={() =>
                  run(
                    () => cancelStaffBooking({ data: { bookingId: b.id, reason: "" } }),
                    `Bookingen er aflyst, og tiden er ledig igen. ${customerChannel(b)}`,
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
                    {CHANNEL_LABEL[j.channel] ?? j.channel} til{" "}
                    {j.recipient_kind === "customer" ? "kunden" : "medarbejderen"} ·{" "}
                    {TEMPLATE_LABEL[j.template] ?? j.template}
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

type EditableBooking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  note: string | null;
};
type CustomerPatch = {
  bookingId: string;
  name: string;
  phone: string;
  email: string;
  note: string;
};

/** Ret kundens oplysninger. Samme validering og telefon-normalisering som serveren. */
function EditCustomer({
  booking,
  busy,
  onSave,
  onCancel,
}: {
  booking: EditableBooking;
  busy: boolean;
  onSave: (data: CustomerPatch) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: booking.customer_name,
    phone: formatPhone(booking.customer_phone),
    email: booking.customer_email ?? "",
    note: booking.note ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = staffUpdateCustomerSchema.safeParse({ bookingId: booking.id, ...form });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof form;
        next[k] ??= issue.message;
      }
      setErrors(next);
      const first = (["name", "phone", "email", "note"] as const).find((k) => next[k]);
      if (first) document.getElementById(`edit-${first}`)?.focus();
      return;
    }
    setErrors({});
    onSave({ bookingId: booking.id, ...form });
  };

  return (
    <section aria-label="Ret kunde" className="rise-in grid gap-6 border-t border-line pt-8">
      <h2 ref={focusOnMount} tabIndex={-1} className="text-2xl leading-8 text-text">
        Ret kunde.
      </h2>
      <form noValidate onSubmit={submit} className="grid gap-4">
        <TextField
          id="edit-name"
          label="Navn"
          autoComplete="off"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
        />
        <TextField
          id="edit-phone"
          label="Mobil"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        <TextField
          id="edit-email"
          label="Mail"
          type="email"
          inputMode="email"
          autoComplete="off"
          optional
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <TextField
          id="edit-note"
          label="Note"
          optional
          maxLength={500}
          value={form.note}
          onChange={set("note")}
          error={errors.note}
        />
        <p className="text-sm text-text-2">Kunden får ikke besked om rettelsen.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Button type="submit" loading={busy}>
            {busy ? "Gemmer …" : "Gem"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annullér
          </Button>
        </div>
      </form>
    </section>
  );
}
