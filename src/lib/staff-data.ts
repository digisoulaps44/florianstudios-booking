/**
 * Datahooks til medarbejderappen. Læser med brugerens egen Supabase-klient, så RLS afgør, hvad
 * man ser: medarbejdere egne bookinger/arbejdstider/notifikationer, ejeren det hele.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import type { Me } from "@/server/staff.server";

export type BookingRow = Tables<"bookings"> & { staff: { display_name: string } | null };
export type StaffRow = Tables<"staff">;
export type WeeklyRow = Tables<"weekly_schedule">;
export type ExceptionRow = Tables<"schedule_exceptions">;
export type StaffTreatmentRow = Tables<"staff_treatments"> & {
  treatment: { name: string; active: boolean } | null;
};
export type TreatmentRow = Tables<"treatments">;
export type NotificationRow = Tables<"notifications">;
export type SettingsRow = Tables<"salon_settings">;
export type MessageJobRow = Tables<"message_jobs">;

export const MeContext = createContext<Me | null>(null);
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe uden for /app");
  return me;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const qk = {
  bookings: (staffId: string | null, from: string, to: string) =>
    ["bookings", staffId ?? "all", from, to] as const,
  booking: (id: string) => ["booking", id] as const,
  staff: ["staff"] as const,
  weekly: (staffId: string) => ["weekly", staffId] as const,
  exceptions: (staffId: string | null, from: string, to: string) =>
    ["exceptions", staffId ?? "all", from, to] as const,
  staffTreatments: (staffId: string | null) => ["staff-treatments", staffId ?? "all"] as const,
  treatments: ["treatments"] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  failedMessages: ["failed-messages"] as const,
};

/** Bookinger (inkl. aflyste) der starter i [from, to). staffId = null → alle (kun ejer). */
export function useBookings(staffId: string | null, from: Date, to: Date) {
  const f = from.toISOString();
  const t = to.toISOString();
  return useQuery({
    queryKey: qk.bookings(staffId, f, t),
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, staff:staff_id(display_name)")
        .gte("starts_at", f)
        .lt("starts_at", t)
        .order("starts_at");
      if (staffId) q = q.eq("staff_id", staffId);
      return unwrap(await q) as BookingRow[];
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: qk.booking(id),
    queryFn: async () => {
      const [booking, events, jobs] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, staff:staff_id(display_name)")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("booking_events").select("*").eq("booking_id", id).order("created_at"),
        supabase
          .from("message_jobs")
          .select(
            "id, channel, template, status, recipient_kind, last_error, sent_at, scheduled_for",
          )
          .eq("booking_id", id)
          .order("created_at"),
      ]);
      return {
        booking: unwrap(booking) as BookingRow | null,
        events: unwrap(events) ?? [],
        jobs: jobs.error ? [] : (jobs.data ?? []), // kun ejeren kan se beskedjobs
      };
    },
  });
}

export function useStaffList() {
  return useQuery({
    queryKey: qk.staff,
    queryFn: async () =>
      unwrap(
        await supabase.from("staff").select("*").order("sort_order").order("display_name"),
      ) as StaffRow[],
  });
}

export function useWeekly(staffId: string | null | undefined) {
  return useQuery({
    queryKey: qk.weekly(staffId ?? "none"),
    enabled: !!staffId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("weekly_schedule")
          .select("*")
          .eq("staff_id", staffId!)
          .order("weekday")
          .order("start_time"),
      ) as WeeklyRow[],
  });
}

export function useExceptions(staffId: string | null, from: Date, to: Date) {
  const f = from.toISOString();
  const t = to.toISOString();
  return useQuery({
    queryKey: qk.exceptions(staffId, f, t),
    queryFn: async () => {
      let q = supabase
        .from("schedule_exceptions")
        .select("*")
        .lt("starts_at", t)
        .gt("ends_at", f)
        .order("starts_at");
      if (staffId) q = q.eq("staff_id", staffId);
      return unwrap(await q) as ExceptionRow[];
    },
  });
}

export function useStaffTreatments(staffId: string | null) {
  return useQuery({
    queryKey: qk.staffTreatments(staffId),
    queryFn: async () => {
      let q = supabase
        .from("staff_treatments")
        .select("*, treatment:treatment_id(name, active)")
        .order("created_at");
      if (staffId) q = q.eq("staff_id", staffId);
      return unwrap(await q) as StaffTreatmentRow[];
    },
  });
}

export function useTreatments() {
  return useQuery({
    queryKey: qk.treatments,
    queryFn: async () =>
      unwrap(
        await supabase.from("treatments").select("*").order("sort_order").order("name"),
      ) as TreatmentRow[],
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ) as NotificationRow[],
  });
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () =>
      unwrap(await supabase.from("salon_settings").select("*").eq("id", 1).single()) as SettingsRow,
  });
}

export function useFailedMessages(enabled: boolean) {
  return useQuery({
    queryKey: qk.failedMessages,
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("message_jobs")
          .select("*")
          .eq("status", "failed")
          .order("failed_at", { ascending: false })
          .limit(100),
      ) as MessageJobRow[],
  });
}

/** Realtime: nye/ændrede bookinger og notifikationer opdaterer kalenderen med det samme. */
export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("staff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void qc.invalidateQueries({ queryKey: ["bookings"] });
        void qc.invalidateQueries({ queryKey: ["booking"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void qc.invalidateQueries({ queryKey: qk.notifications });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
