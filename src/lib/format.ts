/** Dansk formatering af priser, datoer og tider i salonens tidszone. */
import { SALON_TZ } from "./tz";

const priceFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

/** 25000 øre → "250 kr." */
export function formatPrice(ore: number): string {
  return `${priceFmt.format(ore / 100)} kr.`;
}

function fmt(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("da-DK", { timeZone: SALON_TZ, ...options });
}

const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDateFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const longDateYearFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const dowShortFmt = fmt({ weekday: "short" });
const monthYearFmt = fmt({ month: "long", year: "numeric" });

/** "10:30" */
export function formatTime(date: Date): string {
  return timeFmt.format(date).replace(".", ":");
}

/** "torsdag 19. november" (+ år hvis det ikke er i år) */
export function formatDateLong(date: Date, now: Date = new Date()): string {
  const sameYear = fmt({ year: "numeric" }).format(date) === fmt({ year: "numeric" }).format(now);
  return (sameYear ? longDateFmt : longDateYearFmt).format(date);
}

/** "tor. 19. nov." */
export function formatDateShort(date: Date): string {
  return shortDateFmt.format(date);
}

/** "Torsdag 19. november kl. 10:30" */
export function formatWhen(date: Date, now: Date = new Date()): string {
  const s = `${formatDateLong(date, now)} kl. ${formatTime(date)}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Tor" – tre bogstaver som på hjemmesiden ("Man", "Tir" …). */
export function formatDowShort(date: Date): string {
  const s = dowShortFmt.format(date).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1, 3);
}

/** "November 2026" */
export function formatMonthYear(date: Date): string {
  const s = monthYearFmt.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "30 min", "1 t", "1 t 15 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}

/** Noon UTC på en kalenderdag – sikker reference til formatering af en "YYYY-MM-DD". */
export function dateFromDay(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}
