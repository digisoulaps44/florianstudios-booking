/**
 * Offentlige bookingkald (ingen login). Returnerer kun det, kunden skal bruge: behandlinger,
 * medarbejdernavne, priser, varigheder og ledige tider – aldrig andre kunders data.
 * Alle skrivninger går gennem databasefunktionerne (create/reschedule/cancel_booking).
 */
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashToken } from "@/lib/token";
import { addDays, localDate, localTime } from "@/lib/tz";
import type { z } from "zod";
import type {
  createBookingSchema,
  daysSchema,
  managedDaysSchema,
  managedSlotsSchema,
  rescheduleByTokenSchema,
  slotsSchema,
  tokenSchema,
} from "@/lib/booking-schemas";

import {
  bookableRange,
  loadBookableStaffTreatment,
  loadSettings,
  slotsForDays,
  todayInSalon,
  type DayStatus,
} from "./availability.server";
import { bookingLinkToken, bookingLinkTokenHash } from "./links.server";

// ── Fejl som data (UI viser danske tekster) ──────────────────────────────
export type Failure = { ok: false; code: FailureCode; message: string };
export type FailureCode =
  | "rate_limited"
  | "not_found"
  | "treatment_unavailable"
  | "slot_unavailable"
  | "slot_taken"
  | "cutoff_passed"
  | "booking_not_active"
  | "invalid";

const MESSAGES: Record<FailureCode, string> = {
  rate_limited: "Der er sendt mange forespørgsler på kort tid. Vent et øjeblik, og prøv igen.",
  not_found: "Vi kan ikke finde bookingen. Tjek linket i din mail.",
  treatment_unavailable: "Behandlingen kan ikke bookes lige nu. Vælg en anden.",
  slot_unavailable: "Tiden kan ikke længere bookes. Vælg en anden tid.",
  slot_taken: "Tiden blev netop booket af en anden. Vælg en anden tid.",
  cutoff_passed: "Det er for sent at ændre eller aflyse online. Ring til salonen.",
  booking_not_active: "Bookingen er allerede aflyst eller afsluttet.",
  invalid: "Noget i formularen er ikke udfyldt korrekt.",
};

export function fail(code: FailureCode, message?: string): Failure {
  return { ok: false, code, message: message ?? MESSAGES[code] };
}

// Kast-fejl fra Postgres → koder.
function pgCode(error: { code?: string; message?: string } | null): FailureCode | null {
  if (!error) return null;
  if (error.code === "23P01") return "slot_taken";
  const m = error.message ?? "";
  if (m.includes("cutoff_passed")) return "cutoff_passed";
  if (m.includes("treatment_unavailable")) return "treatment_unavailable";
  if (m.includes("booking_not_active")) return "booking_not_active";
  if (m.includes("booking_not_found")) return "not_found";
  return null;
}

// ── Rate limiting ────────────────────────────────────────────────────────
async function clientKey(): Promise<string> {
  const ip =
    getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
  return (await hashToken(`ip:${ip}`)).slice(0, 24);
}

async function allow(
  bucket: string,
  limit: number,
  windowSeconds: number,
  extraKey?: string,
): Promise<boolean> {
  const key = `${bucket}:${extraKey ?? (await clientKey())}`;
  const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit", error.message);
    return true; // Fejl i begrænsningen må ikke spærre for booking.
  }
  return data === true;
}

// ── Katalog ──────────────────────────────────────────────────────────────
export type CatalogTreatment = {
  id: string;
  name: string;
  description: string | null;
  minPriceOre: number;
  maxPriceOre: number;
  minDuration: number;
  maxDuration: number;
};

export type Catalog = {
  ok: true;
  salon: { name: string; address: string; phone: string; cancellationCutoffHours: number };
  treatments: CatalogTreatment[];
};

type OfferRow = {
  id: string;
  price_ore: number;
  duration_minutes: number;
  staff: { id: string; display_name: string; active: boolean; sort_order: number } | null;
  treatment: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    sort_order: number;
  } | null;
};

async function loadOffers(treatmentId?: string): Promise<OfferRow[]> {
  let q = supabaseAdmin
    .from("staff_treatments")
    .select(
      "id, price_ore, duration_minutes, staff:staff_id(id, display_name, active, sort_order), treatment:treatment_id(id, name, description, active, sort_order)",
    )
    .eq("active", true);
  if (treatmentId) q = q.eq("treatment_id", treatmentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as OfferRow[]).filter((r) => r.staff?.active && r.treatment?.active);
}

export async function getCatalog(): Promise<Catalog | Failure> {
  if (!(await allow("read", 240, 60))) return fail("rate_limited");
  const [settings, offers] = await Promise.all([loadSettings(), loadOffers()]);
  const byTreatment = new Map<
    string,
    { t: NonNullable<OfferRow["treatment"]>; rows: OfferRow[] }
  >();
  for (const r of offers) {
    const t = r.treatment!;
    const entry = byTreatment.get(t.id) ?? { t, rows: [] };
    entry.rows.push(r);
    byTreatment.set(t.id, entry);
  }
  const treatments = [...byTreatment.values()]
    .sort((a, b) => a.t.sort_order - b.t.sort_order || a.t.name.localeCompare(b.t.name, "da"))
    .map(({ t, rows }) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      minPriceOre: Math.min(...rows.map((r) => r.price_ore)),
      maxPriceOre: Math.max(...rows.map((r) => r.price_ore)),
      minDuration: Math.min(...rows.map((r) => r.duration_minutes)),
      maxDuration: Math.max(...rows.map((r) => r.duration_minutes)),
    }));
  return {
    ok: true,
    salon: {
      name: settings.name,
      address: settings.address_line,
      phone: settings.phone,
      cancellationCutoffHours: settings.cancellation_cutoff_hours,
    },
    treatments,
  };
}

// ── Medarbejdere for en behandling ───────────────────────────────────────
export type StaffOption = {
  staffTreatmentId: string;
  staffId: string;
  name: string;
  priceOre: number;
  durationMinutes: number;
  nextAvailable: string | null; // ISO
};

export async function getStaffOptions(
  treatmentId: string,
): Promise<{ ok: true; treatmentName: string; staff: StaffOption[] } | Failure> {
  if (!(await allow("read", 240, 60))) return fail("rate_limited");
  const [settings, offers] = await Promise.all([loadSettings(), loadOffers(treatmentId)]);
  if (offers.length === 0) return fail("treatment_unavailable");
  const range = bookableRange(settings);
  const scanDays = Array.from({ length: Math.min(21, settings.booking_horizon_days) }, (_, i) =>
    addDays(range.first, i),
  );

  const staff = await Promise.all(
    offers.map(async (r) => {
      const days = await slotsForDays(
        { staff_id: r.staff!.id, duration_minutes: r.duration_minutes, buffer_minutes: 0 },
        scanDays,
        settings,
      );
      let next: string | null = null;
      for (const d of scanDays) {
        const first = days.get(d)?.slots[0];
        if (first) {
          next = first.toISOString();
          break;
        }
      }
      return {
        staffTreatmentId: r.id,
        staffId: r.staff!.id,
        name: r.staff!.display_name,
        priceOre: r.price_ore,
        durationMinutes: r.duration_minutes,
        nextAvailable: next,
        sort: r.staff!.sort_order,
      };
    }),
  );
  staff.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "da"));
  return {
    ok: true,
    treatmentName: offers[0]!.treatment!.name,
    staff: staff.map(({ sort: _sort, ...s }) => s),
  };
}

// ── Dage og tider ────────────────────────────────────────────────────────
function clampDays(from: string, count: number, first: string, last: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(from, i);
    if (d >= first && d <= last) out.push(d);
  }
  return out;
}

export async function getDays(input: z.output<typeof daysSchema>, excludeBookingId?: string) {
  if (!(await allow("read", 240, 60))) return fail("rate_limited");
  const [settings, st] = await Promise.all([
    loadSettings(),
    loadBookableStaffTreatment(input.staffTreatmentId),
  ]);
  if (!st) return fail("treatment_unavailable");
  const range = bookableRange(settings);
  const requested = Array.from({ length: input.count }, (_, i) => addDays(input.from, i));
  const inRange = clampDays(input.from, input.count, range.first, range.last);
  const computed = await slotsForDays(st, inRange, settings, { excludeBookingId });
  const days: DayStatus[] = requested.map((date) => {
    const c = computed.get(date);
    if (!c) return { date, status: "closed" };
    return { date, status: c.slots.length > 0 ? "available" : c.hasWork ? "full" : "closed" };
  });
  return { ok: true as const, days, today: range.first, lastBookable: range.last };
}

export async function getSlots(input: z.output<typeof slotsSchema>, excludeBookingId?: string) {
  if (!(await allow("read", 240, 60))) return fail("rate_limited");
  const [settings, st] = await Promise.all([
    loadSettings(),
    loadBookableStaffTreatment(input.staffTreatmentId),
  ]);
  if (!st) return fail("treatment_unavailable");
  const range = bookableRange(settings);
  if (input.date < range.first || input.date > range.last)
    return { ok: true as const, slots: [] as Slot[] };
  const computed = await slotsForDays(st, [input.date], settings, { excludeBookingId });
  const slots = (computed.get(input.date)?.slots ?? []).map(toSlot);
  return { ok: true as const, slots };
}

export type Slot = { startsAt: string; time: string };
const toSlot = (d: Date): Slot => ({ startsAt: d.toISOString(), time: localTime(d) });

async function isSlotBookable(
  st: NonNullable<Awaited<ReturnType<typeof loadBookableStaffTreatment>>>,
  startsAt: Date,
  excludeBookingId?: string,
): Promise<{ ok: boolean; alternatives: Slot[] }> {
  const settings = await loadSettings();
  const date = localDate(startsAt);
  const range = bookableRange(settings);
  if (date < range.first || date > range.last) return { ok: false, alternatives: [] };
  const computed = await slotsForDays(st, [date], settings, { excludeBookingId });
  const slots = computed.get(date)?.slots ?? [];
  return {
    ok: slots.some((s) => s.getTime() === startsAt.getTime()),
    alternatives: slots.map(toSlot),
  };
}

// ── Opret booking ────────────────────────────────────────────────────────
export type BookingSummary = {
  id: string;
  treatmentName: string;
  staffName: string;
  startsAt: string;
  durationMinutes: number;
  priceOre: number;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  customerName: string;
  customerEmail: string | null;
  whatsappOptIn: boolean;
};

export async function createBooking(
  input: z.output<typeof createBookingSchema>,
): Promise<
  { ok: true; booking: BookingSummary; manageToken: string } | (Failure & { alternatives?: Slot[] })
> {
  if (input.company) return fail("invalid");
  if (!(await allow("create", 10, 600))) return fail("rate_limited");
  if (!(await allow("create-phone", 5, 3600, await hashToken(input.customer.phone))))
    return fail("rate_limited");

  const st = await loadBookableStaffTreatment(input.staffTreatmentId);
  if (!st) return fail("treatment_unavailable");
  const startsAt = new Date(input.startsAt);

  // Gentaget klik med samme nøgle: returnér den eksisterende booking.
  const existing = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (!existing.data) {
    const check = await isSlotBookable(st, startsAt);
    if (!check.ok) return { ...fail("slot_unavailable"), alternatives: check.alternatives };
  }

  const { data, error } = await supabaseAdmin.rpc("create_booking", {
    p_staff_treatment_id: st.id,
    p_starts_at: startsAt.toISOString(),
    p_customer_name: input.customer.name,
    p_customer_phone: input.customer.phone,
    p_customer_email: input.customer.email,
    p_whatsapp_opt_in: input.customer.whatsappOptIn,
    p_note: null as unknown as string,
    p_source: "online",
    p_idempotency_key: input.idempotencyKey,
    p_token_hash: null as unknown as string,
    p_token_expires_at: null as unknown as string,
    p_actor: "customer",
    p_actor_user_id: null as unknown as string,
  });

  const code = pgCode(error);
  if (code === "slot_taken") {
    const fresh = await isSlotBookable(st, startsAt);
    return { ...fail("slot_taken"), alternatives: fresh.alternatives };
  }
  if (code) return fail(code);
  if (error || !data?.[0]) throw new Error(`create_booking fejlede: ${error?.message}`);

  const bookingId = data[0].booking_id;
  await ensureBookingToken(bookingId, startsAt);
  const summary = await loadSummary(bookingId);
  if (!summary) throw new Error("Bookingen blev oprettet, men kunne ikke læses igen.");
  return { ok: true, booking: summary, manageToken: await bookingLinkToken(bookingId) };
}

/** Gemmer hash af kundens link (idempotent). Linket kan bruges til og med dagen efter tiden. */
export async function ensureBookingToken(bookingId: string, startsAt: Date): Promise<void> {
  const tokenHash = await bookingLinkTokenHash(bookingId);
  const expires = new Date(startsAt.getTime() + 24 * 3600_000);
  const { error } = await supabaseAdmin
    .from("booking_tokens")
    .upsert(
      { booking_id: bookingId, token_hash: tokenHash, expires_at: expires.toISOString() },
      { onConflict: "token_hash" },
    );
  if (error) console.error("booking token", error.message);
}

async function loadSummary(bookingId: string): Promise<BookingSummary | null> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, treatment_name, starts_at, duration_minutes, price_ore, status, customer_name, customer_email, whatsapp_opt_in, staff:staff_id(display_name)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    treatmentName: data.treatment_name,
    staffName: data.staff?.display_name ?? "",
    startsAt: data.starts_at,
    durationMinutes: data.duration_minutes,
    priceOre: data.price_ore,
    status: data.status,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    whatsappOptIn: data.whatsapp_opt_in,
  };
}

// ── Kundens sikre link ───────────────────────────────────────────────────
async function bookingIdFromToken(token: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("booking_tokens")
    .select("booking_id, expires_at, revoked_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!data) return null;
  // Et tilbagekaldt (aflyst) eller udløbet link må stadig vise bookingen, men ikke ændre den.
  return data.booking_id;
}

export type ManagedBooking = {
  ok: true;
  booking: BookingSummary;
  canChange: boolean;
  cutoffHours: number;
  salonPhone: string;
  staffTreatmentId: string | null;
};

export async function getManagedBooking(
  input: z.output<typeof tokenSchema>,
): Promise<ManagedBooking | Failure> {
  if (!(await allow("manage", 60, 600))) return fail("rate_limited");
  const id = await bookingIdFromToken(input.token);
  if (!id) return fail("not_found");
  const [summary, settings, raw] = await Promise.all([
    loadSummary(id),
    loadSettings(),
    supabaseAdmin.from("bookings").select("staff_treatment_id").eq("id", id).single(),
  ]);
  if (!summary) return fail("not_found");
  const cutoff =
    new Date(summary.startsAt).getTime() - settings.cancellation_cutoff_hours * 3600_000;
  return {
    ok: true,
    booking: summary,
    canChange: summary.status === "confirmed" && Date.now() <= cutoff,
    cutoffHours: settings.cancellation_cutoff_hours,
    salonPhone: settings.phone,
    staffTreatmentId: raw.data?.staff_treatment_id ?? null,
  };
}

async function managedStaffTreatment(token: string) {
  const id = await bookingIdFromToken(token);
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id, staff_treatment_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!data?.staff_treatment_id) return null;
  return { bookingId: data.id, staffTreatmentId: data.staff_treatment_id, status: data.status };
}

export async function getManagedDays(input: z.output<typeof managedDaysSchema>) {
  const m = await managedStaffTreatment(input.token);
  if (!m) return fail("not_found");
  return getDays(
    { staffTreatmentId: m.staffTreatmentId, from: input.from, count: input.count },
    m.bookingId,
  );
}

export async function getManagedSlots(input: z.output<typeof managedSlotsSchema>) {
  const m = await managedStaffTreatment(input.token);
  if (!m) return fail("not_found");
  return getSlots({ staffTreatmentId: m.staffTreatmentId, date: input.date }, m.bookingId);
}

export async function rescheduleByToken(input: z.output<typeof rescheduleByTokenSchema>) {
  if (!(await allow("manage-write", 10, 600))) return fail("rate_limited");
  const m = await managedStaffTreatment(input.token);
  if (!m) return fail("not_found");
  const st = await loadBookableStaffTreatment(m.staffTreatmentId);
  if (!st) return fail("treatment_unavailable");
  const startsAt = new Date(input.startsAt);
  const check = await isSlotBookable(st, startsAt, m.bookingId);
  if (!check.ok) return { ...fail("slot_unavailable"), alternatives: check.alternatives };

  const { error } = await supabaseAdmin.rpc("reschedule_booking", {
    p_booking_id: m.bookingId,
    p_new_starts_at: startsAt.toISOString(),
    p_new_staff_treatment_id: null as unknown as string,
    p_actor: "customer",
    p_actor_user_id: null as unknown as string,
  });
  const code = pgCode(error);
  if (code) {
    const fresh = code === "slot_taken" ? await isSlotBookable(st, startsAt, m.bookingId) : null;
    return { ...fail(code), alternatives: fresh?.alternatives };
  }
  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("booking_tokens")
    .update({ expires_at: new Date(startsAt.getTime() + 24 * 3600_000).toISOString() })
    .eq("booking_id", m.bookingId);
  const summary = await loadSummary(m.bookingId);
  return { ok: true as const, booking: summary! };
}

export async function cancelByToken(input: z.output<typeof tokenSchema>) {
  if (!(await allow("manage-write", 10, 600))) return fail("rate_limited");
  const id = await bookingIdFromToken(input.token);
  if (!id) return fail("not_found");
  const { error } = await supabaseAdmin.rpc("cancel_booking", {
    p_booking_id: id,
    p_actor: "customer",
    p_actor_user_id: null as unknown as string,
    p_reason: "Aflyst af kunden via link",
  });
  const code = pgCode(error);
  if (code) return fail(code);
  if (error) throw new Error(error.message);
  const summary = await loadSummary(id);
  return { ok: true as const, booking: summary! };
}

export { todayInSalon };
