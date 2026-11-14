/** Korte tekster til bookingtrinnene (delt mellem trin 1 og 2). */
import { formatDateShort, formatPrice, formatTime } from "./format";
import { localDate } from "./tz";

export function priceRangeLabel(min: number, max: number): string {
  return min === max ? formatPrice(min) : `fra ${formatPrice(min)}`;
}

export function nextAvailableLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Ingen ledige tider de næste 3 uger";
  const d = new Date(iso);
  const day = localDate(d);
  const today = localDate(now);
  const tomorrow = localDate(new Date(now.getTime() + 86_400_000));
  const when = day === today ? "i dag" : day === tomorrow ? "i morgen" : formatDateShort(d);
  return `Første ledige: ${when} ${formatTime(d)}`;
}

export function treatmentCountLabel(n: number): string {
  return n === 1 ? "1 behandling" : `${n} behandlinger`;
}
