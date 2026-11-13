import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo } from "react";

import { ButtonLink, Notice, Spinner } from "@/components/fs/primitives";
import { DayAgenda, PageHeader, findConflicts } from "@/components/fs/staff";
import {
  workingWindows,
  type ExceptionRow as AvExc,
  type WeeklyRow as AvWeekly,
} from "@/lib/availability";
import { formatDateLong, formatPrice } from "@/lib/format";
import { useBookings, useExceptions, useMe, useWeekly } from "@/lib/staff-data";
import { dayBounds, isoWeekday, localDate, zonedToUtc } from "@/lib/tz";
import { useNow } from "@/lib/use-now";

export const Route = createFileRoute("/app/")({ component: Today });

const EXC_LABEL: Record<string, string> = {
  vacation: "Ferie",
  absence: "Fravær",
  block: "Blokeret",
  extra_work: "Ekstra arbejdstid",
};

function Today() {
  const me = useMe();
  const now = useNow();
  const navigate = useNavigate();
  const today = localDate(now);
  const { start, end } = dayBounds(today);
  const staffId = me.staffId;

  const bookings = useBookings(staffId, start, end);
  const weekly = useWeekly(staffId);
  const exceptions = useExceptions(staffId, start, end);

  const view = useMemo(() => {
    if (!bookings.data || !weekly.data || !exceptions.data) return null;
    const weeklyAv: AvWeekly[] = weekly.data.map((w) => ({
      ...w,
      kind: w.kind as AvWeekly["kind"],
    }));
    const excAv: AvExc[] = exceptions.data.map((e) => ({
      kind: e.kind as AvExc["kind"],
      starts_at: new Date(e.starts_at),
      ends_at: new Date(e.ends_at),
    }));
    const windows = staffId
      ? workingWindows({ date: today, weekly: weeklyAv, exceptions: excAv })
      : [];
    const breaks = weeklyAv
      .filter((w) => w.kind === "break" && w.weekday === isoWeekday(today))
      .map((w) => ({
        start: zonedToUtc(today, w.start_time.slice(0, 5)),
        end: zonedToUtc(today, w.end_time.slice(0, 5)),
      }));
    const conflicts = findConflicts(bookings.data, weekly.data, exceptions.data);
    const active = bookings.data.filter((b) => b.status !== "cancelled");
    const next = active.find((b) => b.status === "confirmed" && new Date(b.ends_at) > now);
    const revenue = active
      .filter((b) => b.status !== "no_show")
      .reduce((sum, b) => sum + b.price_ore, 0);
    return { windows, breaks, conflicts, active, next, revenue };
  }, [bookings.data, weekly.data, exceptions.data, staffId, today, now]);

  const title = capitalize(formatDateLong(now));

  return (
    <>
      <PageHeader
        eyebrow="I dag"
        title={title}
        actions={
          <ButtonLink to="/app/ny" variant="secondary" size="sm">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Ny booking
          </ButtonLink>
        }
      />
      {!staffId ? (
        <Notice title="Du har ingen egen kalender." className="mb-6">
          Som ejer uden medarbejderprofil ser du alle kalendere under Kalender.
        </Notice>
      ) : null}
      {exceptions.data
        ?.filter((e) => e.kind !== "extra_work")
        .map((e) => (
          <Notice key={e.id} title={`${EXC_LABEL[e.kind]} i dag`} className="mb-4">
            {e.note ?? "Ingen online-booking i perioden."}
          </Notice>
        ))}
      {view && view.conflicts.size > 0 ? (
        <Notice
          tone="error"
          title={`${view.conflicts.size} ${view.conflicts.size === 1 ? "booking ligger" : "bookinger ligger"} uden for din arbejdstid.`}
          className="mb-6"
        >
          Arbejdstid eller fravær er ændret efter bookingen. Flyt eller aflys – systemet ændrer den
          ikke selv.
        </Notice>
      ) : null}
      {!view ? (
        bookings.isError || weekly.isError || exceptions.isError ? (
          <Notice tone="error" title="Dagen kunne ikke hentes.">
            Tjek forbindelsen, og prøv igen.
          </Notice>
        ) : (
          <Spinner label="Henter dagens aftaler …" />
        )
      ) : (
        <>
          <p className="tabular mb-4 text-sm text-text-2">
            {view.active.length} {view.active.length === 1 ? "aftale" : "aftaler"} ·{" "}
            {formatPrice(view.revenue)}
          </p>
          <DayAgenda
            bookings={bookings.data ?? []}
            windows={view.windows}
            breaks={view.breaks}
            now={now}
            conflicts={view.conflicts}
            nextId={view.next?.id}
            onBookGap={(at) => navigate({ to: "/app/ny", search: { start: at.toISOString() } })}
          />
        </>
      )}
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
