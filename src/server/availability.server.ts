/**
 * Indlæser arbejdstider, undtagelser og optagede tider for en medarbejder og beregner ledige
 * tider med den rene funktion i src/lib/availability.ts. Kun til brug på serveren.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeSlots,
  workingWindows,
  type ExceptionRow,
  type Interval,
  type WeeklyRow,
} from "@/lib/availability";
import { SALON_TZ, addDays, dayBounds, localDate } from "@/lib/tz";

export type SalonSettings = {
  name: string;
  address_line: string;
  phone: string;
  timezone: string;
  cancellation_cutoff_hours: number;
  reminder_hours_before: number;
  booking_horizon_days: number;
  slot_interval_minutes: number;
  min_notice_minutes: number;
};

export async function loadSettings(): Promise<SalonSettings> {
  const { data, error } = await supabaseAdmin
    .from("salon_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error(`Kunne ikke hente salonindstillinger: ${error?.message}`);
  return data;
}

export type StaffTreatment = {
  id: string;
  staff_id: string;
  treatment_id: string;
  price_ore: number;
  duration_minutes: number;
  buffer_minutes: number;
  treatment_name: string;
  staff_name: string;
};

/** En aktiv medarbejders aktive behandling – eller null, hvis den ikke kan bookes. */
export async function loadBookableStaffTreatment(id: string): Promise<StaffTreatment | null> {
  const { data, error } = await supabaseAdmin
    .from("staff_treatments")
    .select(
      "id, staff_id, treatment_id, price_ore, duration_minutes, buffer_minutes, active, staff:staff_id(display_name, active), treatment:treatment_id(name, active)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.active || !data.staff?.active || !data.treatment?.active) return null;
  return {
    id: data.id,
    staff_id: data.staff_id,
    treatment_id: data.treatment_id,
    price_ore: data.price_ore,
    duration_minutes: data.duration_minutes,
    buffer_minutes: data.buffer_minutes,
    treatment_name: data.treatment.name,
    staff_name: data.staff.display_name,
  };
}

type StaffCalendarData = { weekly: WeeklyRow[]; exceptions: ExceptionRow[]; busy: Interval[] };

export async function loadStaffCalendar(
  staffId: string,
  from: Date,
  to: Date,
  excludeBookingId?: string,
): Promise<StaffCalendarData> {
  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select("id, starts_at, blocked_until")
    .eq("staff_id", staffId)
    .neq("status", "cancelled")
    .lt("starts_at", to.toISOString())
    .gt("blocked_until", from.toISOString());
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq("id", excludeBookingId);

  const [weekly, exceptions, bookings] = await Promise.all([
    supabaseAdmin
      .from("weekly_schedule")
      .select("weekday, kind, start_time, end_time")
      .eq("staff_id", staffId),
    supabaseAdmin
      .from("schedule_exceptions")
      .select("kind, starts_at, ends_at")
      .eq("staff_id", staffId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
    bookingsQuery,
  ]);
  for (const r of [weekly, exceptions, bookings]) if (r.error) throw new Error(r.error.message);

  return {
    weekly: (weekly.data ?? []).map((w) => ({ ...w, kind: w.kind as WeeklyRow["kind"] })),
    exceptions: (exceptions.data ?? []).map((e) => ({
      kind: e.kind as ExceptionRow["kind"],
      starts_at: new Date(e.starts_at),
      ends_at: new Date(e.ends_at),
    })),
    busy: (bookings.data ?? []).map((b) => ({
      start: new Date(b.starts_at),
      end: new Date(b.blocked_until),
    })),
  };
}

export type DayStatus = { date: string; status: "available" | "full" | "closed" };

export function todayInSalon(now: Date = new Date()): string {
  return localDate(now, SALON_TZ);
}

/** Første og sidste dag, der kan bookes, ud fra bookinghorisonten. */
export function bookableRange(
  settings: SalonSettings,
  now: Date = new Date(),
): { first: string; last: string } {
  const first = todayInSalon(now);
  return { first, last: addDays(first, settings.booking_horizon_days - 1) };
}

export async function slotsForDays(
  st: Pick<StaffTreatment, "staff_id" | "duration_minutes" | "buffer_minutes">,
  days: string[],
  settings: SalonSettings,
  opts: {
    excludeBookingId?: string | undefined;
    now?: Date | undefined;
    ignoreNotice?: boolean | undefined;
  } = {},
): Promise<Map<string, { slots: Date[]; hasWork: boolean }>> {
  const result = new Map<string, { slots: Date[]; hasWork: boolean }>();
  if (days.length === 0) return result;
  const now = opts.now ?? new Date();
  const from = dayBounds(days[0]!).start;
  const to = dayBounds(days[days.length - 1]!).end;
  const cal = await loadStaffCalendar(st.staff_id, from, to, opts.excludeBookingId);
  for (const date of days) {
    const hasWork =
      workingWindows({ date, weekly: cal.weekly, exceptions: cal.exceptions }).length > 0;
    const slots = computeSlots({
      date,
      weekly: cal.weekly,
      exceptions: cal.exceptions,
      busy: cal.busy,
      durationMinutes: st.duration_minutes,
      bufferMinutes: st.buffer_minutes,
      slotIntervalMinutes: settings.slot_interval_minutes,
      now,
      minNoticeMinutes: opts.ignoreNotice ? 0 : settings.min_notice_minutes,
    });
    result.set(date, { slots, hasWork });
  }
  return result;
}
