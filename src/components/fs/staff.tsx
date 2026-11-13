/**
 * Medarbejderappens komponenter: AppShell (top + fanebjælke), PageHeader, Segmented,
 * AppointmentCard og DayAgenda (lodret liste – ikke et presset desktop-timegitter).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Bell, CalendarDays, Clock, Menu, Plus, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import {
  workingWindows,
  type ExceptionRow as AvExceptionRow,
  type WeeklyRow as AvWeeklyRow,
} from "@/lib/availability";
import { formatDuration, formatPrice, formatTime } from "@/lib/format";
import type { BookingRow, ExceptionRow, WeeklyRow } from "@/lib/staff-data";
import { localDate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { Eyebrow, StatusBadge, type BookingStatus } from "./primitives";

// ── Shell ────────────────────────────────────────────────────────────────
const TABS = [
  { to: "/app", label: "I dag", icon: Clock, exact: true },
  { to: "/app/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/app/ny", label: "Ny", icon: Plus },
  { to: "/app/notifikationer", label: "Beskeder", icon: Bell },
  { to: "/app/mere", label: "Mere", icon: Menu },
] as const;

export function AppShell({ children, unread }: { children: ReactNode; unread: number }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-ink">
      <a
        href="#indhold"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-skip) focus:bg-bone focus:px-4 focus:py-3 focus:text-ink"
      >
        Spring til indhold
      </a>
      <header className="sticky top-0 z-(--z-header) border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-site items-center justify-between gap-3 px-gutter">
          <Link
            to="/app"
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.12em] uppercase text-text"
          >
            Florian Studios
            <Scissors aria-hidden="true" className="h-4 w-4" />
          </Link>
          <nav aria-label="Hovedmenu" className="hidden md:block">
            <ul className="flex items-center gap-6">
              {TABS.map((t) => (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    activeOptions={{ exact: "exact" in t }}
                    className="inline-flex min-h-11 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-text-2 hover:text-text data-[status=active]:text-text"
                  >
                    {t.label}
                    {t.to === "/app/notifikationer" && unread > 0 ? (
                      <UnreadCount n={unread} />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="indhold"
        tabIndex={-1}
        className="mx-auto max-w-narrow px-gutter pt-6 pb-32 focus:outline-none md:pb-16"
      >
        {children}
      </main>
      <nav
        aria-label="Faner"
        className="pb-safe fixed inset-x-0 bottom-0 z-(--z-bookbar) border-t border-line-strong bg-ink/95 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const active =
              "exact" in t ? path === t.to || path === `${t.to}/` : path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.15em]",
                    active ? "text-text" : "text-text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  {t.label}
                  {t.to === "/app/notifikationer" && unread > 0 ? (
                    <span className="absolute top-2 left-1/2 ml-2">
                      <UnreadCount n={unread} />
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UnreadCount({ n }: { n: number }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center bg-bone px-1 text-[10px] leading-4 font-medium text-ink">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> ulæste</span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-1 text-2xl leading-8 text-text md:text-3xl md:leading-9">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex border border-control">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 min-w-18 px-4 text-xs font-medium uppercase tracking-[0.18em]",
            i > 0 && "border-l border-control",
            o.value === value ? "bg-bone text-ink" : "text-text-2 hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Aftalekort ───────────────────────────────────────────────────────────
export function AppointmentCard({
  booking,
  next,
  eyebrow,
  showStaff,
  conflict,
  actions,
}: {
  booking: BookingRow;
  next?: boolean | undefined;
  eyebrow?: string | undefined;
  showStaff?: boolean | undefined;
  conflict?: boolean | undefined;
  actions?: ReactNode;
}) {
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const cancelled = booking.status === "cancelled";
  return (
    <article
      className={cn(
        "grid gap-4 border p-4",
        next
          ? "grid-cols-[6.5rem_minmax(0,1fr)] border-bone bg-ink-3"
          : "grid-cols-[4.5rem_minmax(0,1fr)] border-line-strong",
        conflict && "border-closed",
      )}
    >
      <div>
        <p
          className={cn(
            "tabular font-display leading-none text-text",
            next ? "text-4xl" : "text-2xl",
            cancelled && "text-text-muted line-through",
          )}
        >
          {formatTime(start)}
        </p>
        <p className="tabular mt-1 text-xs text-text-muted">–{formatTime(end)}</p>
      </div>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1 text-text">{eyebrow}</Eyebrow> : null}
        <Link
          to="/app/booking/$id"
          params={{ id: booking.id }}
          className={cn(
            "block text-base font-medium text-text after:absolute hover:underline",
            cancelled && "text-text-muted line-through",
          )}
        >
          {booking.customer_name}
        </Link>
        <p className="text-sm text-text-2">
          {booking.treatment_name} · {formatPrice(booking.price_ore)} ·{" "}
          {formatDuration(booking.duration_minutes)}
          {showStaff && booking.staff ? ` · ${booking.staff.display_name}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge status={booking.status as BookingStatus} />
          {conflict ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-closed">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              Konflikt
            </span>
          ) : null}
          {actions}
        </div>
      </div>
    </article>
  );
}

// ── Konflikter ───────────────────────────────────────────────────────────
/** En aktiv booking er i konflikt, når behandlingen ikke længere ligger inden for arbejdstid. */
export function findConflicts(
  bookings: BookingRow[],
  weekly: WeeklyRow[],
  exceptions: ExceptionRow[],
): Set<string> {
  const out = new Set<string>();
  const byStaff = new Map<string, { weekly: AvWeeklyRow[]; exceptions: AvExceptionRow[] }>();
  const scheduleFor = (staffId: string) => {
    let s = byStaff.get(staffId);
    if (!s) {
      s = {
        weekly: weekly
          .filter((w) => w.staff_id === staffId)
          .map((w) => ({ ...w, kind: w.kind as AvWeeklyRow["kind"] })),
        exceptions: exceptions
          .filter((e) => e.staff_id === staffId)
          .map((e) => ({
            kind: e.kind as AvExceptionRow["kind"],
            starts_at: new Date(e.starts_at),
            ends_at: new Date(e.ends_at),
          })),
      };
      byStaff.set(staffId, s);
    }
    return s;
  };
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const s = scheduleFor(b.staff_id);
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    const windows = workingWindows({
      date: localDate(start),
      weekly: s.weekly,
      exceptions: s.exceptions,
    });
    if (!windows.some((w) => start >= w.start && end <= w.end)) out.add(b.id);
  }
  return out;
}

// ── Dagsoverblik ─────────────────────────────────────────────────────────
type Item =
  | { kind: "booking"; booking: BookingRow }
  | { kind: "gap"; start: Date; end: Date }
  | { kind: "pause"; start: Date; end: Date };

export function DayAgenda({
  bookings,
  windows,
  breaks,
  now,
  conflicts,
  showStaff,
  nextId,
  onBookGap,
}: {
  bookings: BookingRow[];
  windows: Array<{ start: Date; end: Date }>;
  breaks: Array<{ start: Date; end: Date }>;
  now: Date;
  conflicts: Set<string>;
  showStaff?: boolean | undefined;
  nextId?: string | undefined;
  onBookGap?: ((start: Date) => void) | undefined;
}) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const items: Item[] = bookings.map((b) => ({ kind: "booking", booking: b }));
  for (const p of breaks) items.push({ kind: "pause", start: p.start, end: p.end });
  // Ledige huller ≥ 15 min inden for arbejdstid (kun i visninger for én medarbejder).
  if (!showStaff) {
    for (const w of windows) {
      let cursor = w.start;
      const inside = active
        .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.blocked_until) }))
        .filter((b) => b.end > w.start && b.start < w.end)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const b of inside) {
        if (b.start.getTime() - cursor.getTime() >= 15 * 60_000)
          items.push({ kind: "gap", start: cursor, end: b.start });
        if (b.end > cursor) cursor = b.end;
      }
      if (w.end.getTime() - cursor.getTime() >= 15 * 60_000)
        items.push({ kind: "gap", start: cursor, end: w.end });
    }
  }
  const at = (i: Item) =>
    (i.kind === "booking" ? new Date(i.booking.starts_at) : i.start).getTime();
  items.sort((a, b) => at(a) - at(b));
  const nowIndex = items.findIndex((i) => at(i) > now.getTime());

  if (items.length === 0) {
    return (
      <p className="border border-dashed border-line-strong p-6 text-text-2">
        Ingen arbejdstid eller aftaler denne dag.
      </p>
    );
  }

  return (
    <ol className="grid gap-2">
      {items.map((item, idx) => (
        <li
          key={item.kind === "booking" ? item.booking.id : `${item.kind}-${item.start.getTime()}`}
          className="relative"
        >
          {idx === nowIndex ? <NowLine now={now} /> : null}
          {item.kind === "booking" ? (
            <AppointmentCard
              booking={item.booking}
              next={item.booking.id === nextId}
              eyebrow={item.booking.id === nextId ? nextEyebrow(item.booking, now) : undefined}
              showStaff={showStaff}
              conflict={conflicts.has(item.booking.id)}
            />
          ) : item.kind === "pause" ? (
            <div className="hatch flex min-h-11 items-center gap-4 border border-line px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
              Pause {formatTime(item.start)}–{formatTime(item.end)}
            </div>
          ) : (
            <div className="tabular flex min-h-12 items-center justify-between gap-4 border border-dashed border-line-strong px-4 py-2 text-sm text-text-2">
              <span>
                Ledig {formatTime(item.start)}–{formatTime(item.end)} ·{" "}
                {formatDuration(Math.round((item.end.getTime() - item.start.getTime()) / 60_000))}
              </span>
              {onBookGap && item.end > now ? (
                <button
                  type="button"
                  onClick={() => onBookGap(item.start > now ? item.start : now)}
                  className="min-h-11 text-xs font-medium uppercase tracking-[0.18em] text-text-2 underline-offset-4 hover:text-text hover:underline"
                >
                  Book
                </button>
              ) : null}
            </div>
          )}
        </li>
      ))}
      {nowIndex === -1 &&
      localDate(now) === localDate(items.length ? new Date(at(items[items.length - 1]!)) : now) ? (
        <li>
          <NowLine now={now} />
        </li>
      ) : null}
    </ol>
  );
}

function NowLine({ now }: { now: Date }) {
  return (
    <div className="mb-2 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text after:h-px after:flex-1 after:bg-bone">
      Nu · {formatTime(now)}
    </div>
  );
}

function nextEyebrow(b: BookingRow, now: Date): string {
  const mins = Math.round((new Date(b.starts_at).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "I gang nu";
  if (mins < 60) return `Næste kunde · om ${mins} min`;
  return `Næste kunde · kl. ${formatTime(new Date(b.starts_at))}`;
}
