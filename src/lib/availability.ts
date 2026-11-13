/**
 * Beregning af ledige tider for én medarbejder på én lokal kalenderdag.
 *
 * Ren funktion uden I/O – samme kode bruges af det offentlige bookingflow, af medarbejderens
 * "ny booking" og af serverens kontrol lige før en booking gemmes. Den endelige beskyttelse mod
 * dobbeltbooking er databasens EXCLUDE-constraint; denne beregning sørger for, at kunden kun
 * ser tider, der reelt kan bookes.
 */
import { SALON_TZ, addDays, dayBounds, isoWeekday, zonedToUtc } from "./tz";

export type Interval = { start: Date; end: Date };

export type WeeklyRow = {
  weekday: number; // ISO 1–7
  kind: "work" | "break";
  start_time: string; // "HH:MM" eller "HH:MM:SS"
  end_time: string;
};

export type ExceptionRow = {
  kind: "vacation" | "absence" | "block" | "extra_work";
  starts_at: Date;
  ends_at: Date;
};

export type AvailabilityInput = {
  date: string; // "YYYY-MM-DD" i salonens tidszone
  weekly: WeeklyRow[];
  exceptions: ExceptionRow[];
  /** Eksisterende ikke-aflyste bookinger: [starts_at, blocked_until) */
  busy: Interval[];
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  now: Date;
  minNoticeMinutes: number;
  tz?: string;
};

const MIN = 60_000;

/** Union af intervaller (sorteret, sammenflettet). */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list
    .filter((i) => i.end.getTime() > i.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start.getTime() <= last.end.getTime()) {
      if (i.end.getTime() > last.end.getTime()) last.end = new Date(i.end.getTime());
    } else {
      out.push({ start: new Date(i.start.getTime()), end: new Date(i.end.getTime()) });
    }
  }
  return out;
}

/** Trækker `remove` fra `base`. Begge må være usorterede. */
export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  let result = mergeIntervals(base);
  for (const r of mergeIntervals(remove)) {
    const next: Interval[] = [];
    for (const b of result) {
      if (r.end <= b.start || r.start >= b.end) {
        next.push(b);
        continue;
      }
      if (r.start > b.start) next.push({ start: b.start, end: r.start });
      if (r.end < b.end) next.push({ start: r.end, end: b.end });
    }
    result = next;
  }
  return result;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function clip(i: Interval, bounds: Interval): Interval | null {
  const start = i.start > bounds.start ? i.start : bounds.start;
  const end = i.end < bounds.end ? i.end : bounds.end;
  return end > start ? { start, end } : null;
}

/** Arbejdstid for dagen efter ugeskema, ekstra tider, pauser, ferie, fravær og blokeringer. */
export function workingWindows(
  input: Pick<AvailabilityInput, "date" | "weekly" | "exceptions" | "tz">,
): Interval[] {
  const tz = input.tz ?? SALON_TZ;
  const day = dayBounds(input.date, tz);
  const weekday = isoWeekday(input.date);
  const toInterval = (row: WeeklyRow): Interval => ({
    start: zonedToUtc(input.date, row.start_time.slice(0, 5), tz),
    end: zonedToUtc(input.date, row.end_time.slice(0, 5), tz),
  });

  const rows = input.weekly.filter((r) => r.weekday === weekday);
  const work: Interval[] = rows.filter((r) => r.kind === "work").map(toInterval);
  const breaks: Interval[] = rows.filter((r) => r.kind === "break").map(toInterval);

  for (const e of input.exceptions) {
    const c = clip({ start: e.starts_at, end: e.ends_at }, day);
    if (!c) continue;
    if (e.kind === "extra_work") work.push(c);
    else breaks.push(c);
  }
  return subtractIntervals(work, breaks);
}

/**
 * Starttidspunkter (UTC) for ledige tider. En tid er ledig når
 *  – selve behandlingen [start, start + varighed) ligger inden for arbejdstid,
 *  – hele det blokerede tidsrum [start, start + varighed + buffer) ikke overlapper
 *    en eksisterende booking (samme regel som databasens EXCLUDE-constraint),
 *  – start ligger mindst `minNoticeMinutes` ude i fremtiden.
 * Tiderne ligger på et lokalt gitter (fx hvert 15. minut fra midnat).
 */
export function computeSlots(input: AvailabilityInput): Date[] {
  const tz = input.tz ?? SALON_TZ;
  const windows = workingWindows(input);
  if (windows.length === 0) return [];
  const busy = mergeIntervals(input.busy);
  const earliest = input.now.getTime() + input.minNoticeMinutes * MIN;
  const step = input.slotIntervalMinutes;
  const seen = new Set<number>();
  const slots: Date[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    const start = zonedToUtc(input.date, `${hh}:${mm}`, tz);
    const t = start.getTime();
    if (seen.has(t) || t < earliest) continue;
    seen.add(t);

    const service: Interval = { start, end: new Date(t + input.durationMinutes * MIN) };
    const blocked: Interval = {
      start,
      end: new Date(t + (input.durationMinutes + input.bufferMinutes) * MIN),
    };
    const inside = windows.some((w) => service.start >= w.start && service.end <= w.end);
    if (!inside) continue;
    if (busy.some((b) => overlaps(blocked, b))) continue;
    slots.push(start);
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Kalenderdage fra `from` (inkl.) og `count` dage frem. */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
