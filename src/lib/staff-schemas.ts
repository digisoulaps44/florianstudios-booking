import { z } from "zod";

import { isoDateTime, uuid } from "./booking-schemas";
import { normalizePhone } from "./phone";

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Skriv et gyldigt telefonnummer." });
      return z.NEVER;
    }
    return n;
  });

export const staffCustomerSchema = z.object({
  name: z.string().trim().min(1, "Skriv kundens navn.").max(120),
  phone,
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("Ugyldig mailadresse.").max(254)])
    .default(""),
  whatsappOptIn: z.boolean().default(false),
});

export const staffCreateBookingSchema = z.object({
  staffTreatmentId: uuid,
  startsAt: isoDateTime,
  customer: staffCustomerSchema,
  note: z.string().trim().max(500).optional().default(""),
  ignoreSchedule: z.boolean().default(false),
  idempotencyKey: uuid,
});

export const staffRescheduleSchema = z.object({
  bookingId: uuid,
  startsAt: isoDateTime,
  staffTreatmentId: uuid.optional(),
  ignoreSchedule: z.boolean().default(false),
});

export const staffCancelSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(300).optional().default(""),
});

export const staffSetStatusSchema = z.object({
  bookingId: uuid,
  status: z.enum(["confirmed", "completed", "no_show"]),
});

export const inviteStaffSchema = z.object({
  displayName: z.string().trim().min(1, "Skriv et navn.").max(80),
  email: z.string().trim().email("Skriv en gyldig mailadresse."),
  phone: z.string().trim().max(20).optional().default(""),
});

export const setStaffActiveSchema = z.object({ staffId: uuid, active: z.boolean() });

export const retryMessageSchema = z.object({ jobId: uuid });

export const staffSlotsSchema = z.object({
  staffTreatmentId: uuid,
  date: z.string(),
  excludeBookingId: uuid.optional(),
});
