/**
 * Grundkomponenter fra design systemet "Florian Studios": Button, Eyebrow, Notice, StatusBadge,
 * TextField, CheckboxRow, Monogram. Radius 0, hairlines, bone som eneste accent.
 */
import { Link, type LinkProps } from "@tanstack/react-router";
import { AlertTriangle, Check, Info } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

// ── Button ───────────────────────────────────────────────────────────────
export type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ButtonSize = "md" | "sm";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  const base =
    "inline-flex items-center justify-center gap-3 whitespace-nowrap text-xs font-medium uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:shrink-0";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-bone text-ink hover:bg-bone/90",
    secondary: "border border-control text-text hover:bg-bone hover:text-ink",
    ghost: "text-text-2 underline-offset-4 hover:text-text hover:underline",
    icon: "border border-control text-text hover:bg-bone hover:text-ink",
  };
  const sizes =
    variant === "icon"
      ? size === "md"
        ? "h-12 w-12"
        : "h-11 w-11"
      : variant === "ghost"
        ? "min-h-11 py-2"
        : size === "md"
          ? "min-h-12 px-7 py-3"
          : "min-h-11 px-5 py-2.5";
  return cn(base, variants[variant], sizes, className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...rest} />
  );
});

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}

// ── Eyebrow ──────────────────────────────────────────────────────────────
export function Eyebrow({
  className,
  children,
  as: Tag = "p",
}: {
  className?: string;
  children: ReactNode;
  as?: "p" | "span" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "font-body text-xs font-medium uppercase tracking-[0.2em] text-text-muted",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ── Notice ───────────────────────────────────────────────────────────────
export function Notice({
  tone = "info",
  title,
  children,
  actions,
  className,
  live,
  reveal = false,
}: {
  tone?: "info" | "error" | "success";
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  live?: boolean;
  /** Svar på en handling: rul beskeden ind og tag fokus, hvis knappen forsvandt. */
  reveal?: boolean;
}) {
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? Check : Info;
  const ref = useRef<HTMLDivElement>(null);
  // Svar på en handling står ofte øverst, mens knappen sidder nederst. Rul beskeden ind,
  // hvis den ikke er synlig – ellers sker der tilsyneladende ingenting.
  const revealKey = typeof title === "string" ? title : null;
  useEffect(() => {
    const el = ref.current;
    if (!reveal || !el) return;
    // Forsvandt knappen (deaktiveret eller fjernet), står fokus på <body>. Sæt det på beskeden,
    // så tastatur- og skærmlæserbrugere fortsætter derfra.
    if (!document.activeElement || document.activeElement === document.body)
      el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    if (r.top >= 72 && r.bottom <= window.innerHeight - 96) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [reveal, revealKey]);
  return (
    <div
      ref={ref}
      tabIndex={reveal ? -1 : undefined}
      role={tone === "error" ? "alert" : live ? "status" : undefined}
      className={cn(
        "flex items-start gap-3 border bg-ink-3 p-4",
        tone === "error" ? "border-closed" : "border-control",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 h-5 w-5",
          tone === "error" ? "text-closed" : tone === "success" ? "text-open" : "text-text-2",
        )}
      />
      <div className="min-w-0">
        <p className="text-base font-medium text-text">{title}</p>
        {children ? <div className="mt-1 text-sm text-text-2">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">{actions}</div> : null}
      </div>
    </div>
  );
}

// ── Status ───────────────────────────────────────────────────────────────
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";
const STATUS: Record<BookingStatus, { label: string; dot: string; muted?: boolean }> = {
  confirmed: { label: "Bekræftet", dot: "bg-open" },
  completed: { label: "Gennemført", dot: "bg-bone", muted: true },
  cancelled: {
    label: "Aflyst",
    dot: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--color-closed)]",
  },
  no_show: { label: "Udeblevet", dot: "bg-closed" },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 whitespace-nowrap border px-2.5 py-1 text-[11px] font-medium uppercase leading-4 tracking-[0.18em]",
        s.muted ? "border-line-strong text-text-2" : "border-control text-text",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusDot({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", open ? "bg-open" : "bg-closed")}
    />
  );
}

// ── TextField ────────────────────────────────────────────────────────────
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  prefix?: string | undefined;
  optional?: boolean | undefined;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, prefix, optional, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
        {optional ? <span className="font-normal text-text-muted"> (valgfri)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-text-2">
          {hint}
        </p>
      ) : null}
      <div
        className={cn(
          "flex items-stretch border bg-ink-3 transition-colors focus-within:border-bone focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-focus",
          error ? "border-closed" : "border-control",
        )}
      >
        {prefix ? (
          <span
            aria-hidden="true"
            className="tabular inline-flex items-center border-r border-line-strong px-4 text-base text-text-2"
          >
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="min-h-12 min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-text outline-none placeholder:text-text-muted"
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-sm text-closed">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
});

// ── Checkbox ─────────────────────────────────────────────────────────────
export function CheckboxRow({
  checked,
  onChange,
  title,
  description,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  name?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="relative flex min-h-11 cursor-pointer items-start gap-4 py-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="peer absolute h-px w-px opacity-0"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border border-control text-ink transition-colors peer-checked:border-bone peer-checked:bg-bone peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-focus [&>svg]:invisible peer-checked:[&>svg]:visible"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span>
        <span className="block text-base font-medium text-text">{title}</span>
        {description ? (
          <span id={`${id}-desc`} className="mt-1 block text-sm text-text-2">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

// ── Monogram ─────────────────────────────────────────────────────────────
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center border border-control bg-ink-3 font-display text-lg tracking-[0.05em] text-text",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Henter …" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-sm text-text-2">
      {label}
    </p>
  );
}
