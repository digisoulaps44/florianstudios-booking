import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { Button, Notice, Spinner } from "@/components/fs/primitives";
import { DayAgenda, PageHeader, Segmented, findConflicts } from "@/components/fs/staff";
import {
  workingWindows,
  type ExceptionRow as AvExc,
  type WeeklyRow as AvWeekly,
} from "@/lib/availability";
import {
  dateFromDay,
  formatDateLong,
  formatDateShort,
  formatPrice,
  formatTime,
} from "@/lib/format";
import {
  useBookings,
  useExceptions,
  useMe,
  useStaffList,
  useWeekly,
  type BookingRow,
} from "@/lib/staff-data";
import {
  addDays,
  dayBounds,
  isValidDateString,
  isoWeekday,
  localDate,
  startOfIsoWeek,
  zonedToUtc,
} from "@/lib/tz";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/kalender")({
  validateSearch: z.object({
    dato: z.string().refine(isValidDateString).optional(),
    visning: z.enum(["dag", "uge"]).optional(),
    medarbejder: z.string().optional(), // uuid eller "alle" (kun ejer)
  }),
  component: Calendar,
});

function Calendar() {
  const me = useMe();
  const now = useNow();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/kalender" });
  const staffList = useStaffList();
  const date = search.dato ?? localDate(now);
  const view = search.visning ?? "dag";
  const staffId = me.isOwner
    ? search.medarbejder === "alle"
      ? null
      : (search.medarbejder ?? me.staffId)
    : me.staffId;

  const range = useMemo(() => {
    if (view === "dag") return dayBounds(date);
    const monday = startOfIsoWeek(date);
    return { start: dayBounds(monday).start, end: dayBounds(addDays(monday, 6)).end };
  }, [view, date]);

  const bookings = useBookings(staffId, range.start, range.end);
  const exceptions = useExceptions(staffId, range.start, range.end);
  const weekly = useWeekly(staffId);

  const go = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
  const step = view === "dag" ? 1 : 7;

  return (
    <>
      <PageHeader
        eyebrow={view === "dag" ? "Dag" : "Uge"}
        title={view === "dag" ? capitalize(formatDateLong(dateFromDay(date))) : weekTitle(date)}
        actions={
          <Segmented
            label="Visning"
            value={view}
            onChange={(v) => go({ visning: v })}
            options={[
              { value: "dag", label: "Dag" },
              { value: "uge", label: "Uge" },
            ]}
          />
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant="icon"
          size="sm"
          aria-label={view === "dag" ? "Forrige dag" : "Forrige uge"}
          onClick={() => go({ dato: addDays(date, -step) })}
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => go({ dato: localDate(now) })}>
          I dag
        </Button>
        <Button
          variant="icon"
          size="sm"
          aria-label={view === "dag" ? "Næste dag" : "Næste uge"}
          onClick={() => go({ dato: addDays(date, step) })}
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </Button>
        {me.isOwner && staffList.data ? (
          <label className="ml-auto flex items-center gap-2 text-sm text-text-2">
            <span className="sr-only md:not-sr-only">Kalender</span>
            <select
              value={search.medarbejder ?? me.staffId ?? "alle"}
              onChange={(e) => go({ medarbejder: e.target.value })}
              className="min-h-11 border border-control bg-ink-3 px-3 text-base text-text"
            >
              <option value="alle">Alle medarbejdere</option>
              {staffList.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                  {s.active ? "" : " (deaktiveret)"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {bookings.isError ? (
        <Notice tone="error" title="Kalenderen kunne ikke hentes." />
      ) : !bookings.data || !exceptions.data || (staffId && !weekly.data) ? (
        <Spinner label="Henter kalender …" />
      ) : view === "dag" ? (
        <DayView
          date={date}
          now={now}
          staffId={staffId}
          bookings={bookings.data}
          weekly={weekly.data ?? []}
          exceptions={exceptions.data}
          onBookGap={(at) => navigate({ to: "/app/ny", search: { start: at.toISOString() } })}
        />
      ) : (
        <WeekView
          monday={startOfIsoWeek(date)}
          today={localDate(now)}
          bookings={bookings.data}
          conflicts={findConflicts(bookings.data, weekly.data ?? [], exceptions.data)}
          showStaff={!staffId}
          onOpenDay={(d) => go({ dato: d, visning: "dag" })}
        />
      )}
    </>
  );
}

function DayView({
  date,
  now,
  staffId,
  bookings,
  weekly,
  exceptions,
  onBookGap,
}: {
  date: string;
  now: Date;
  staffId: string | null;
  bookings: BookingRow[];
  weekly: ReturnType<typeof useWeekly>["data"] & object;
  exceptions: NonNullable<ReturnType<typeof useExceptions>["data"]>;
  onBookGap: (at: Date) => void;
}) {
  const weeklyAv: AvWeekly[] = weekly.map((w) => ({ ...w, kind: w.kind as AvWeekly["kind"] }));
  const excAv: AvExc[] = exceptions.map((e) => ({
    kind: e.kind as AvExc["kind"],
    starts_at: new Date(e.starts_at),
    ends_at: new Date(e.ends_at),
  }));
  const windows = staffId ? workingWindows({ date, weekly: weeklyAv, exceptions: excAv }) : [];
  const breaks = staffId
    ? weeklyAv
        .filter((w) => w.kind === "break" && w.weekday === isoWeekday(date))
        .map((w) => ({
          start: zonedToUtc(date, w.start_time.slice(0, 5)),
          end: zonedToUtc(date, w.end_time.slice(0, 5)),
        }))
    : [];
  const conflicts = findConflicts(bookings, weekly, exceptions);
  const next = bookings.find((b) => b.status === "confirmed" && new Date(b.ends_at) > now);
  return (
    <DayAgenda
      bookings={bookings}
      windows={windows}
      breaks={breaks}
      now={now}
      conflicts={conflicts}
      showStaff={!staffId}
      nextId={localDate(now) === date ? next?.id : undefined}
      onBookGap={staffId ? onBookGap : undefined}
    />
  );
}

function WeekView({
  monday,
  today,
  bookings,
  conflicts,
  showStaff,
  onOpenDay,
}: {
  monday: string;
  today: string;
  bookings: BookingRow[];
  conflicts: Set<string>;
  showStaff: boolean;
  onOpenDay: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <ul className="border-y border-line">
      {days.map((d, i) => {
        const list = bookings.filter((b) => localDate(new Date(b.starts_at)) === d);
        const active = list.filter((b) => b.status !== "cancelled");
        const revenue = active
          .filter((b) => b.status !== "no_show")
          .reduce((s, b) => s + b.price_ore, 0);
        return (
          <li key={d} className={cn(i > 0 && "border-t border-line", d === today && "bg-bone/10")}>
            <button
              type="button"
              onClick={() => onOpenDay(d)}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-3 py-3 text-left hover:bg-bone/10"
              aria-current={d === today ? "date" : undefined}
            >
              <span className="text-sm uppercase tracking-[0.15em] text-text">
                {capitalize(formatDateShort(dateFromDay(d)))}
                {d === today ? (
                  <span className="ml-3 text-xs tracking-[0.2em] text-text">I dag</span>
                ) : null}
              </span>
              <span className="tabular text-sm text-text-2">
                {active.length === 0
                  ? "Ingen aftaler"
                  : `${active.length} ${active.length === 1 ? "aftale" : "aftaler"} · ${formatPrice(revenue)}`}
              </span>
            </button>
            {list.length > 0 ? (
              <ul className="grid gap-1 px-3 pb-3">
                {list.map((b) => (
                  <li key={b.id}>
                    <Link
                      to="/app/booking/$id"
                      params={{ id: b.id }}
                      className={cn(
                        "tabular flex min-h-11 items-center gap-3 border border-line px-3 text-sm hover:bg-bone/10",
                        conflicts.has(b.id) && "border-closed",
                        b.status === "cancelled" && "text-text-muted line-through",
                      )}
                    >
                      <span className="text-text">{formatTime(new Date(b.starts_at))}</span>
                      <span className="min-w-0 truncate text-text-2">
                        {b.customer_name} · {b.treatment_name}
                        {showStaff && b.staff ? ` · ${b.staff.display_name}` : ""}
                      </span>
                      {b.status === "cancelled" ? (
                        <span className="ml-auto inline-block text-xs uppercase tracking-[0.18em] text-text-muted">
                          Aflyst
                        </span>
                      ) : conflicts.has(b.id) ? (
                        <span className="ml-auto text-xs uppercase tracking-[0.18em] text-closed">
                          Konflikt
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function weekTitle(date: string) {
  const monday = startOfIsoWeek(date);
  const sunday = addDays(monday, 6);
  return `${formatDateShort(dateFromDay(monday))} – ${formatDateShort(dateFromDay(sunday))}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
