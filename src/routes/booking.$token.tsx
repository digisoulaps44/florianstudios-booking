import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  CustomerShell,
  DateStrip,
  SummaryList,
  TimeSlots,
  type SlotItem,
} from "@/components/fs/booking";
import {
  Button,
  ButtonLink,
  Eyebrow,
  Notice,
  Spinner,
  StatusBadge,
  StatusDot,
} from "@/components/fs/primitives";
import {
  fetchManagedBooking,
  fetchManagedDays,
  fetchManagedSlots,
  submitCancel,
  submitReschedule,
} from "@/lib/booking.functions";
import {
  dateFromDay,
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTime,
  formatWhen,
} from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import { addDays, localDate } from "@/lib/tz";

const ADDRESS = "Toggangen 1, 2730 Herlev";

export const Route = createFileRoute("/booking/$token")({
  validateSearch: z.object({ ny: z.coerce.number().optional() }),
  loader: ({ params }) => fetchManagedBooking({ data: { token: params.token } }),
  head: () => ({
    meta: [{ title: "Din booking – Florian Studios" }, { name: "robots", content: "noindex" }],
  }),
  component: ManageBooking,
});

function ManageBooking() {
  const result = Route.useLoaderData();
  const { ny } = Route.useSearch();
  const { token } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate({ from: "/booking/$token" });
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [ny]);

  if (!result.ok) {
    return (
      <CustomerShell>
        <h1 className="text-2xl text-text md:text-3xl">Bookingen kunne ikke findes.</h1>
        <Notice
          tone="error"
          title={result.message}
          className="mt-8"
          actions={
            <ButtonLink to="/" variant="ghost">
              Book en ny tid
            </ButtonLink>
          }
        />
      </CustomerShell>
    );
  }

  const b = result.booking;
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const firstName = b.customerName.split(" ")[0] ?? b.customerName;
  const weekday = formatDateLong(start).split(" ")[0];

  const summary = (
    <SummaryList
      rows={[
        { term: "Behandling", value: `${b.treatmentName} · ${formatDuration(b.durationMinutes)}` },
        { term: "Frisør", value: b.staffName },
        { term: "Tidspunkt", value: formatWhen(start) },
      ]}
      total={{ term: "Pris", value: formatPrice(b.priceOre) }}
    />
  );

  const addToCalendar = () =>
    downloadIcs({
      uid: b.id,
      title: `${b.treatmentName} hos Florian Studios`,
      start,
      end,
      location: `Florian Studios, ${ADDRESS}`,
      description: `${b.treatmentName} hos ${b.staffName}. Ændr eller aflys: ${window.location.origin}/booking/${token}`,
    });

  // ── Bekræftelse lige efter booking ──
  if (ny && b.status === "confirmed") {
    return (
      <CustomerShell>
        <div className="grid gap-8">
          <div className="grid gap-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-text">
              <StatusDot open />
              Booking bekræftet
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02] text-text focus:outline-none"
            >
              Tak, {firstName}.
              <em className="block text-text-2">
                Vi ses {weekday} kl. {formatTime(start)}.
              </em>
            </h1>
          </div>
          {summary}
          <Notice tone="success" title="Bekræftelsen er på vej." live>
            Vi sender den til {b.customerEmail}
            {b.whatsappOptIn ? " og på WhatsApp" : ""}. Du får en påmindelse inden din tid. Gem
            linket i mailen – det er din adgang til at ændre eller aflyse.
          </Notice>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button onClick={addToCalendar}>
              <Calendar aria-hidden="true" className="h-4 w-4" />
              Tilføj til kalender
            </Button>
            <Button variant="ghost" onClick={() => navigate({ search: {}, replace: true })}>
              Ændr eller aflys
            </Button>
          </div>
          <Address />
        </div>
      </CustomerShell>
    );
  }

  // ── Administration via linket ──
  const reload = async (text: string) => {
    setMode("view");
    setMessage({ tone: "success", text });
    await router.invalidate();
  };

  return (
    <CustomerShell>
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Eyebrow>Din booking</Eyebrow>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl leading-9 text-text focus:outline-none"
          >
            {b.treatmentName} hos {b.staffName}.
          </h1>
          <div>
            <StatusBadge status={b.status} />
          </div>
        </div>

        {message ? <Notice tone={message.tone} title={message.text} live /> : null}

        {summary}

        {b.status === "cancelled" ? (
          <Notice
            title="Bookingen er aflyst."
            actions={
              <ButtonLink to="/" variant="ghost">
                Book en ny tid
              </ButtonLink>
            }
          />
        ) : b.status !== "confirmed" ? null : !result.canChange ? (
          <Notice title="Det er for sent at ændre eller aflyse online.">
            Ændringer skal ske senest {result.cutoffHours} timer før. Ring til salonen på{" "}
            <a
              href={`tel:${result.salonPhone.replace(/\s/g, "")}`}
              className="underline underline-offset-4"
            >
              {result.salonPhone}
            </a>
            .
          </Notice>
        ) : mode === "move" ? (
          <MoveBooking
            token={token}
            current={b.startsAt}
            onCancel={() => setMode("view")}
            onMoved={(when) => reload(`Din tid er flyttet til ${when}. Du får en ny bekræftelse.`)}
          />
        ) : mode === "cancel" ? (
          <CancelBooking
            token={token}
            onKeep={() => setMode("view")}
            onCancelled={() => reload("Din booking er aflyst. Du får en bekræftelse på mail.")}
          />
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-text-2">
              Du kan ændre eller aflyse online frem til {result.cutoffHours} timer før din tid.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button variant="secondary" onClick={() => setMode("move")}>
                Flyt tid
              </Button>
              <Button variant="ghost" onClick={() => setMode("cancel")}>
                Aflys booking
              </Button>
              <Button variant="ghost" onClick={addToCalendar}>
                Tilføj til kalender
              </Button>
            </div>
          </div>
        )}
        <Address />
      </div>
    </CustomerShell>
  );
}

function Address() {
  return (
    <p className="flex items-start gap-3 text-sm text-text-2">
      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Florian Studios · {ADDRESS}</span>
    </p>
  );
}

function MoveBooking({
  token,
  current,
  onCancel,
  onMoved,
}: {
  token: string;
  current: string;
  onCancel: () => void;
  onMoved: (when: string) => void;
}) {
  const today = localDate(new Date());
  const [from, setFrom] = useState(today);
  const [date, setDate] = useState<string>();
  const [slot, setSlot] = useState<SlotItem>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const days = useQuery({
    queryKey: ["managed-days", token, from],
    queryFn: () => fetchManagedDays({ data: { token, from, count: 7 } }),
  });
  const dayList = days.data?.ok ? days.data.days : [];
  const lastBookable = days.data?.ok ? days.data.lastBookable : undefined;
  const selectedDate =
    date && dayList.some((d) => d.date === date)
      ? date
      : dayList.find((d) => d.status === "available")?.date;

  const slots = useQuery({
    queryKey: ["managed-slots", token, selectedDate],
    queryFn: () => fetchManagedSlots({ data: { token, date: selectedDate! } }),
    enabled: !!selectedDate,
  });
  const slotList = (slots.data?.ok ? slots.data.slots : []).filter(
    (s) => s.startsAt !== new Date(current).toISOString(),
  );

  const save = async () => {
    if (!slot || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await submitReschedule({ data: { token, startsAt: slot.startsAt } });
      if (r.ok) {
        const when = formatWhen(new Date(slot.startsAt));
        onMoved(when.charAt(0).toLowerCase() + when.slice(1));
      } else {
        setError(r.message);
        setSlot(undefined);
        await slots.refetch();
      }
    } catch {
      setError("Tiden kunne ikke flyttes. Din oprindelige tid er bevaret. Prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Flyt tid" className="grid gap-8 border-t border-line pt-8">
      <h2 className="text-2xl leading-8 text-text">Vælg ny tid.</h2>
      {error ? (
        <Notice tone="error" title={error}>
          Din oprindelige tid er bevaret.
        </Notice>
      ) : null}
      {days.isPending ? (
        <Spinner label="Henter ledige dage …" />
      ) : (
        <DateStrip
          days={dayList}
          selected={selectedDate}
          today={today}
          onSelect={(d) => {
            setDate(d);
            setSlot(undefined);
          }}
          canPrev={from > today}
          canNext={!lastBookable || addDays(from, 7) <= lastBookable}
          onPrev={() => setFrom((f) => (addDays(f, -7) > today ? addDays(f, -7) : today))}
          onNext={() => setFrom((f) => addDays(f, 7))}
        />
      )}
      {selectedDate ? (
        slots.isPending ? (
          <Spinner label="Henter ledige tider …" />
        ) : slotList.length === 0 ? (
          <p className="border border-dashed border-line-strong p-6 text-text-2">
            Ingen ledige tider {formatDateLong(dateFromDay(selectedDate))}.
          </p>
        ) : (
          <TimeSlots
            slots={slotList}
            selected={slot?.startsAt}
            onSelect={setSlot}
            label={`Ledige tider ${formatDateLong(dateFromDay(selectedDate))}`}
          />
        )
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button onClick={save} disabled={!slot || busy} aria-busy={busy || undefined}>
          {busy ? "Flytter …" : slot ? `Flyt til kl. ${slot.time}` : "Vælg en tid"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Behold nuværende tid
        </Button>
      </div>
    </section>
  );
}

function CancelBooking({
  token,
  onKeep,
  onCancelled,
}: {
  token: string;
  onKeep: () => void;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await submitCancel({ data: { token } });
      if (r.ok) onCancelled();
      else setError(r.message);
    } catch {
      setError("Bookingen kunne ikke aflyses. Prøv igen, eller ring til salonen.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Aflys booking" className="grid gap-6 border-t border-line pt-8">
      <h2 className="text-2xl leading-8 text-text">Aflys booking?</h2>
      <p className="text-base text-text-2">Tiden bliver ledig for andre. Det kan ikke fortrydes.</p>
      {error ? <Notice tone="error" title={error} /> : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button onClick={confirm} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Aflyser …" : "Ja, aflys"}
        </Button>
        <Button variant="ghost" onClick={onKeep}>
          Behold tiden
        </Button>
      </div>
    </section>
  );
}
