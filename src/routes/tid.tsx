import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  BookBar,
  CustomerShell,
  DateStrip,
  StepHeader,
  TimeSlots,
  type SlotItem,
} from "@/components/fs/booking";
import { Button, ButtonLink, Notice, Spinner } from "@/components/fs/primitives";
import { fetchDays, fetchSlots, fetchStaffOptions } from "@/lib/booking.functions";
import { dateFromDay, formatDateLong, formatDuration, formatPrice } from "@/lib/format";
import { addDays, isValidDateString, localDate } from "@/lib/tz";

const search = z.object({
  behandling: z.string().uuid(),
  tilbud: z.string().uuid(),
  dato: z.string().refine(isValidDateString).optional(),
});

export const Route = createFileRoute("/tid")({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ behandling: search.behandling }),
  loader: ({ deps }) => fetchStaffOptions({ data: { treatmentId: deps.behandling } }),
  head: () => ({ meta: [{ title: "Vælg tidspunkt – Florian Studios" }] }),
  component: ChooseTime,
});

const WEEK = 7;

function ChooseTime() {
  const options = Route.useLoaderData();
  const { behandling, tilbud, dato } = Route.useSearch();
  const navigate = useNavigate({ from: "/tid" });
  const today = localDate(new Date());
  const [from, setFrom] = useState(() =>
    dato && dato > today ? weekContaining(dato, today) : today,
  );
  const [slot, setSlot] = useState<SlotItem>();
  const back = { to: "/frisor", search: { behandling }, label: "Vælg frisør" };

  const offer = options.ok ? options.staff.find((s) => s.staffTreatmentId === tilbud) : undefined;

  const days = useQuery({
    queryKey: ["days", tilbud, from],
    queryFn: () => fetchDays({ data: { staffTreatmentId: tilbud, from, count: WEEK } }),
    enabled: !!offer,
  });

  const dayList = days.data?.ok ? days.data.days : [];
  const lastBookable = days.data?.ok ? days.data.lastBookable : undefined;
  const firstAvailable = dayList.find((d) => d.status === "available")?.date;
  const selectedDate = dato && dayList.some((d) => d.date === dato) ? dato : firstAvailable;

  const slots = useQuery({
    queryKey: ["slots", tilbud, selectedDate],
    queryFn: () => fetchSlots({ data: { staffTreatmentId: tilbud, date: selectedDate! } }),
    enabled: !!offer && !!selectedDate,
  });

  useEffect(() => setSlot(undefined), [selectedDate]);

  const slotList = useMemo(() => (slots.data?.ok ? slots.data.slots : []), [slots.data]);

  if (!options.ok || !offer) {
    return (
      <CustomerShell>
        <StepHeader step={3} title="Vælg tidspunkt." back={back} />
        <Notice
          tone="error"
          title="Frisøren kan ikke bookes til denne behandling lige nu."
          className="mt-8"
          actions={
            <ButtonLink to="/frisor" search={{ behandling }} variant="ghost">
              Vælg en anden frisør
            </ButtonLink>
          }
        />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell
      bar={
        <BookBar
          summary={`${options.treatmentName} · ${formatPrice(offer.priceOre)}`}
          sub={`${offer.name} · ${formatDuration(offer.durationMinutes)}`}
        >
          <Button
            disabled={!slot}
            onClick={() =>
              slot &&
              navigate({ to: "/oplysninger", search: { behandling, tilbud, tid: slot.startsAt } })
            }
          >
            {slot ? `Vælg kl. ${slot.time}` : "Vælg tidspunkt"}
          </Button>
        </BookBar>
      }
    >
      <StepHeader
        step={3}
        title="Vælg tidspunkt."
        back={back}
        lede={`${offer.name} · ${options.treatmentName}`}
      />

      <section className="mt-8" aria-label="Dato">
        {days.isPending ? (
          <Spinner label="Henter ledige dage …" />
        ) : days.data && !days.data.ok ? (
          <Notice tone="error" title="Datoerne kunne ikke hentes.">
            {days.data.message}
          </Notice>
        ) : (
          <DateStrip
            days={dayList}
            selected={selectedDate}
            today={today}
            onSelect={(d) => navigate({ search: (s) => ({ ...s, dato: d }), replace: true })}
            canPrev={from > today}
            canNext={!lastBookable || addDays(from, WEEK) <= lastBookable}
            onPrev={() => setFrom((f) => maxDate(addDays(f, -WEEK), today))}
            onNext={() => setFrom((f) => addDays(f, WEEK))}
          />
        )}
      </section>

      <section className="mt-10" aria-live="polite">
        {!selectedDate ? (
          days.isPending ? null : (
            <EmptyWeek
              onNext={() => setFrom((f) => addDays(f, WEEK))}
              canNext={!lastBookable || addDays(from, WEEK) <= lastBookable}
            />
          )
        ) : slots.isPending ? (
          <Spinner label="Henter ledige tider …" />
        ) : slots.data && !slots.data.ok ? (
          <Notice tone="error" title="Tiderne kunne ikke hentes.">
            {slots.data.message}
          </Notice>
        ) : slotList.length === 0 ? (
          <div className="grid justify-items-start gap-4 border border-dashed border-line-strong p-6">
            <p className="text-text-2">
              Ingen ledige tider {formatDateLong(dateFromDay(selectedDate))}.
            </p>
          </div>
        ) : (
          <TimeSlots
            slots={slotList}
            selected={slot?.startsAt}
            onSelect={setSlot}
            label={`Ledige tider ${formatDateLong(dateFromDay(selectedDate))}`}
          />
        )}
      </section>
    </CustomerShell>
  );
}

function EmptyWeek({ onNext, canNext }: { onNext: () => void; canNext: boolean }) {
  return (
    <div className="grid justify-items-start gap-4 border border-dashed border-line-strong p-6">
      <p className="text-text-2">Ingen ledige tider i denne uge.</p>
      {canNext ? (
        <Button variant="secondary" size="sm" onClick={onNext}>
          Se næste uge
        </Button>
      ) : null}
    </div>
  );
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

function weekContaining(date: string, today: string) {
  // Vis den uge (7 dage fra i dag), hvor den valgte dato ligger.
  let from = today;
  while (addDays(from, WEEK) <= date) from = addDays(from, WEEK);
  return from;
}
