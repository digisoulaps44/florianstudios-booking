/** Serverfunktioner til medarbejder-/ejerappen. Alle kræver login (requireSupabaseAuth). */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  inviteStaffSchema,
  retryMessageSchema,
  setStaffActiveSchema,
  staffCancelSchema,
  staffCreateBookingSchema,
  staffRescheduleSchema,
  staffSetStatusSchema,
  staffSlotsSchema,
} from "./staff-schemas";

const staff = () => import("@/server/staff.server");

export const fetchMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await staff()).whoAmI(context));

export const createStaffBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(staffCreateBookingSchema)
  .handler(async ({ data, context }) => (await staff()).staffCreateBooking(context, data));

export const rescheduleStaffBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(staffRescheduleSchema)
  .handler(async ({ data, context }) => (await staff()).staffReschedule(context, data));

export const cancelStaffBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(staffCancelSchema)
  .handler(async ({ data, context }) => (await staff()).staffCancel(context, data));

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(staffSetStatusSchema)
  .handler(async ({ data, context }) => (await staff()).staffSetStatus(context, data));

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(inviteStaffSchema)
  .handler(async ({ data, context }) =>
    (await staff()).inviteStaff(context, data, getRequestUrl().origin),
  );

export const setStaffMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setStaffActiveSchema)
  .handler(async ({ data, context }) => (await staff()).setStaffActive(context, data));

export const retryFailedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(retryMessageSchema)
  .handler(async ({ data, context }) => (await staff()).retryMessage(context, data));

/** Ledige tider set fra medarbejderen: ingen varselsgrænse, egen booking kan udelades ved flytning. */
export const fetchStaffSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(staffSlotsSchema)
  .handler(async ({ data, context }) => {
    const { whoAmI } = await staff();
    const me = await whoAmI(context);
    const { loadBookableStaffTreatment, loadSettings, slotsForDays } =
      await import("@/server/availability.server");
    const st = await loadBookableStaffTreatment(data.staffTreatmentId);
    if (!st || (!me.isOwner && st.staff_id !== me.staffId))
      return { ok: false as const, slots: [] };
    const settings = await loadSettings();
    const map = await slotsForDays(st, [data.date], settings, {
      excludeBookingId: data.excludeBookingId,
      ignoreNotice: true,
    });
    const { localTime } = await import("@/lib/tz");
    return {
      ok: true as const,
      slots: (map.get(data.date)?.slots ?? []).map((d) => ({
        startsAt: d.toISOString(),
        time: localTime(d),
      })),
    };
  });
