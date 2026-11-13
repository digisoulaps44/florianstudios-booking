/**
 * Tidszone-hjælpere. Alle tider gemmes som UTC (timestamptz) og vises/beregnes i salonens
 * tidszone (Europe/Copenhagen). Sommer-/vintertid håndteres her og kun her.
 *
 * Datoer uden klokkeslæt repræsenteres som "YYYY-MM-DD" (lokal kalenderdag i salonen).
 */
export const SALON_TZ = "Europe/Copenhagen";

export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO 8601: 1 = mandag … 7 = søndag */
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(date: Date, tz: string = SALON_TZ): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 1,
  };
}

/** Forskel (minutter) mellem lokal vægtid i `tz` og UTC på et givet tidspunkt. CET = 60, CEST = 120. */
export function tzOffsetMinutes(date: Date, tz: string = SALON_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

function parseDate(dateStr: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Ugyldig dato: ${dateStr}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function parseTime(timeStr: string): [number, number] {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(timeStr);
  if (!m) throw new Error(`Ugyldigt klokkeslæt: ${timeStr}`);
  return [Number(m[1]), Number(m[2])];
}

/**
 * Lokal vægtid → UTC. Ved forårsskift (02:00–03:00 findes ikke) flyttes tiden frem med
 * springet; ved efterårsskift (02:00–03:00 findes to gange) vælges den første forekomst.
 */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string = SALON_TZ): Date {
  const [y, mo, d] = parseDate(dateStr);
  const [h, mi] = parseTime(timeStr);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Prøv offset fra lige før og lige efter – vælg den første, der rammer vægtiden.
  const before = tzOffsetMinutes(new Date(wall - 12 * 3600_000), tz);
  const after = tzOffsetMinutes(new Date(wall + 12 * 3600_000), tz);
  for (const offset of [Math.max(before, after), Math.min(before, after)]) {
    const candidate = new Date(wall - offset * 60_000);
    const p = zonedParts(candidate, tz);
    if (p.hour === h && p.minute === mi && p.day === d) return candidate;
  }
  // Vægtiden findes ikke (forårsskift): brug offset fra før springet → lander efter springet.
  return new Date(wall - before * 60_000);
}

/** UTC → lokal kalenderdag "YYYY-MM-DD". */
export function localDate(date: Date, tz: string = SALON_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC → lokalt klokkeslæt "HH:MM". */
export function localTime(date: Date, tz: string = SALON_TZ): string {
  const p = zonedParts(date, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Kalenderaritmetik på "YYYY-MM-DD" (uafhængig af tidszone). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = parseDate(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** ISO-ugedag for en kalenderdag: 1 = mandag … 7 = søndag. */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = parseDate(dateStr);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Start og slut (UTC) på en lokal kalenderdag – 23 eller 25 timer ved tidsskift. */
export function dayBounds(dateStr: string, tz: string = SALON_TZ): { start: Date; end: Date } {
  return {
    start: zonedToUtc(dateStr, "00:00", tz),
    end: zonedToUtc(addDays(dateStr, 1), "00:00", tz),
  };
}

/** Mandag i den uge, dagen ligger i. */
export function startOfIsoWeek(dateStr: string): string {
  return addDays(dateStr, 1 - isoWeekday(dateStr));
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parseDate(value);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
