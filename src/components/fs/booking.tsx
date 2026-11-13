/**
 * Booking-komponenter fra design systemet: StepHeader, OptionList, DateStrip, TimeSlots,
 * SummaryList, BookBar og CustomerShell.
 */
import { Link, useRouter } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Phone, Scissors } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { dateFromDay, formatDowShort, formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button, Eyebrow, buttonClasses } from "./primitives";

export const SALON_PHONE_E164 = "+4571530766";
export const SALON_PHONE = "+45 71 53 07 66";
export const STEPS = ["Behandling", "Frisør", "Tidspunkt", "Dine oplysninger", "Bekræft"] as const;

// ── Shell ────────────────────────────────────────────────────────────────
export function CustomerShell({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink">
      <a
        href="#indhold"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-skip) focus:bg-bone focus:px-4 focus:py-3 focus:text-ink"
      >
        Spring til indhold
      </a>
      <header className="sticky top-0 z-(--z-header) border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-header max-w-text items-center justify-between gap-3 px-gutter">
          <a
            href="https://florianstudio.dk"
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.12em] whitespace-nowrap text-text uppercase sm:text-lg sm:tracking-[0.2em]"
          >
            Florian Studios
            <Scissors aria-hidden="true" className="hidden h-4 w-4 sm:block" />
          </a>
          <a
            href={`tel:${SALON_PHONE_E164}`}
            className={buttonClasses("icon", "sm")}
            aria-label={`Ring til Florian Studios på ${SALON_PHONE}`}
          >
            <Phone aria-hidden="true" className="h-5 w-5" />
          </a>
        </div>
      </header>
      <main
        id="indhold"
        tabIndex={-1}
        className={cn(
          "mx-auto max-w-text px-gutter pt-8 focus:outline-none",
          bar ? "pb-36" : "pb-16",
        )}
      >
        {children}
      </main>
      {bar}
    </div>
  );
}

// ── Trin ─────────────────────────────────────────────────────────────────
export function StepHeader({
  step,
  title,
  back,
  lede,
}: {
  step: number; // 1–5
  title: string;
  back?: { to: string; search?: Record<string, unknown>; label: string };
  lede?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Flyt fokus til overskriften ved trinskift, så skærmlæsere hører det nye trin.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);
  return (
    <div className="grid gap-3">
      <div className="-ml-3 flex items-center gap-2">
        {back ? (
          <Link
            to={back.to}
            search={back.search as never}
            aria-label={`Tilbage til ${back.label}`}
            className="inline-flex h-11 w-11 items-center justify-center text-text-2 hover:text-text"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
        ) : (
          <span className="w-3" />
        )}
        <div>
          <Eyebrow>
            Trin {step} af {STEPS.length}
          </Eyebrow>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl leading-8 text-text focus:outline-none md:text-3xl md:leading-9"
          >
            {title}
          </h1>
        </div>
      </div>
      <nav aria-label="Bookingtrin">
        <ol className="grid grid-flow-col gap-1">
          {STEPS.map((name, i) => (
            <li
              key={name}
              aria-current={i + 1 === step ? "step" : undefined}
              className={cn("h-0.5", i + 1 <= step ? "bg-bone" : "bg-line-strong")}
            >
              <span className="sr-only">
                {name}
                {i + 1 < step ? " (udfyldt)" : i + 1 === step ? " (aktuelt trin)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      {lede ? <p className="mt-2 text-base text-text-2">{lede}</p> : null}
    </div>
  );
}

// ── Valgliste ────────────────────────────────────────────────────────────
export function OptionList({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="border-y border-line-strong [&>label+label]:border-t [&>label+label]:border-line-strong">
        {children}
      </div>
    </fieldset>
  );
}

export function OptionRow({
  name,
  value,
  checked,
  onSelect,
  leading,
  title,
  meta,
  extra,
  price,
  titleClassName,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  extra?: ReactNode;
  price?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-18 cursor-pointer items-center gap-4 px-3 py-4 transition-colors hover:bg-bone/10",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-focus",
        checked && "bg-bone/10 shadow-[inset_0_0_0_1px_var(--color-bone)]",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="absolute h-px w-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center border text-ink",
          checked ? "border-bone bg-bone" : "border-control",
        )}
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      {leading}
      <span className="flex min-w-0 flex-1 items-baseline gap-4">
        <span className="min-w-0">
          <span className={cn("block font-display text-2xl leading-8 text-text", titleClassName)}>
            {title}
          </span>
          {meta ? <span className="mt-0.5 block text-sm text-text-2">{meta}</span> : null}
          {extra ? (
            <span className="mt-0.5 block text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
              {extra}
            </span>
          ) : null}
        </span>
        {price ? (
          <>
            <span aria-hidden="true" className="flex-1 border-b border-dotted border-line-strong" />
            <span className="whitespace-nowrap font-display text-2xl leading-8 text-text">
              {price}
            </span>
          </>
        ) : null}
      </span>
    </label>
  );
}

// ── Datovælger ───────────────────────────────────────────────────────────
export type DayItem = { date: string; status: "available" | "full" | "closed" };

export function DateStrip({
  days,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  days: DayItem[];
  selected: string | undefined;
  today: string;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const month = days[0] ? formatMonthYear(dateFromDay(days[0].date)) : "";
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="font-display text-xl leading-7 text-text" aria-live="polite">
          {month}
        </p>
        <div className="flex gap-2">
          <Button
            variant="icon"
            size="sm"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Forrige uge"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Næste uge"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <ul
        aria-label="Vælg dato"
        className="-m-1 grid snap-x snap-mandatory auto-cols-[minmax(3.75rem,1fr)] grid-flow-col gap-2 overflow-x-auto p-1 [scrollbar-width:none]"
      >
        {days.map((d) => {
          const disabled = d.status !== "available";
          const isSelected = d.date === selected;
          const date = dateFromDay(d.date);
          const tag =
            d.date === today
              ? "I dag"
              : d.status === "closed"
                ? "Lukket"
                : d.status === "full"
                  ? "Fuldt"
                  : "";
          return (
            <li key={d.date} className="snap-start">
              <button
                type="button"
                aria-pressed={isSelected}
                aria-disabled={disabled || undefined}
                onClick={() => !disabled && onSelect(d.date)}
                className={cn(
                  "flex min-h-19 w-full flex-col items-center justify-center gap-0.5 border px-1 py-2 transition-colors",
                  isSelected
                    ? "border-bone bg-bone text-ink"
                    : disabled
                      ? "cursor-not-allowed border-dashed border-line text-text-muted"
                      : "border-control text-text hover:bg-bone/10",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.18em]",
                    isSelected ? "text-ink" : "text-text-2",
                  )}
                >
                  {formatDowShort(date)}
                </span>
                <span className="font-display text-2xl leading-7">
                  {Number(d.date.slice(8, 10))}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-[0.15em]",
                    isSelected ? "text-ink" : "text-text-muted",
                  )}
                >
                  {tag || " "}
                </span>
                {disabled ? <span className="sr-only">, ingen ledige tider</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Tider ────────────────────────────────────────────────────────────────
export type SlotItem = { startsAt: string; time: string };

export function TimeSlots({
  slots,
  selected,
  onSelect,
  label,
}: {
  slots: SlotItem[];
  selected: string | undefined;
  onSelect: (slot: SlotItem) => void;
  label: string;
}) {
  const morning = slots.filter((s) => s.time < "12:00");
  const afternoon = slots.filter((s) => s.time >= "12:00");
  const group = (title: string, items: SlotItem[]) =>
    items.length === 0 ? null : (
      <div>
        <Eyebrow className="mb-3">{title}</Eyebrow>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((s) => (
            <li key={s.startsAt}>
              <button
                type="button"
                aria-pressed={s.startsAt === selected}
                onClick={() => onSelect(s)}
                className={cn(
                  "tabular min-h-12 w-full border p-2 text-base font-medium transition-colors",
                  s.startsAt === selected
                    ? "border-bone bg-bone text-ink"
                    : "border-control text-text hover:bg-bone/10",
                )}
              >
                {s.time}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div role="group" aria-label={label} className="grid gap-6">
      {group("Formiddag", morning)}
      {group("Eftermiddag", afternoon)}
    </div>
  );
}

// ── Opsummering ──────────────────────────────────────────────────────────
export function SummaryList({
  rows,
  total,
}: {
  rows: Array<{
    term: string;
    value: ReactNode;
    edit?: { to: string; search?: Record<string, unknown>; label: string };
  }>;
  total?: { term: string; value: ReactNode };
}) {
  return (
    <dl className="border-y border-line-strong">
      {rows.map((r, i) => (
        <div key={r.term} className={cn("py-4", i > 0 && "border-t border-line")}>
          <dt className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
            {r.term}
          </dt>
          <dd className="mt-1 flex items-center justify-between gap-4 text-base text-text">
            <span className="min-w-0">{r.value}</span>
            {r.edit ? (
              <Link
                to={r.edit.to}
                search={r.edit.search as never}
                className={buttonClasses("ghost", "md", "-my-2.5 shrink-0")}
              >
                Ret<span className="sr-only"> {r.edit.label}</span>
              </Link>
            ) : null}
          </dd>
        </div>
      ))}
      {total ? (
        <div className="border-t border-line-strong py-4">
          <dt className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
            {total.term}
          </dt>
          <dd className="mt-1 font-display text-2xl leading-8 text-text">{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}

// ── BookBar ──────────────────────────────────────────────────────────────
export function BookBar({
  summary,
  sub,
  children,
}: {
  summary?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-(--z-bookbar) border-t border-line-strong bg-ink/95 px-gutter pt-3 backdrop-blur">
      <div className="mx-auto flex max-w-text items-center gap-3">
        {summary ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base leading-6 text-text">{summary}</p>
            {sub ? <p className="truncate text-xs text-text-muted">{sub}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function useBackOnEscape() {
  const router = useRouter();
  return () => router.history.back();
}
