/** Inputvalidering delt mellem klient og server (zod). Fejltekster er på dansk. */
import { z } from "zod";

import { normalizePhone } from "./phone";
import { isValidDateString } from "./tz";

export const uuid = z.string().uuid();
export const dateString = z.string().refine(isValidDateString, "Ugyldig dato.");
export const isoDateTime = z.string().datetime({ offset: true });

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Skriv dit navn.").max(120, "Navnet er for langt."),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Skriv et dansk mobilnummer på 8 cifre.",
        });
        return z.NEVER;
      }
      return n;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Mailadressen er for lang.")
    .email("Skriv en gyldig mailadresse, fx navn@mail.dk."),
  whatsappOptIn: z.boolean().default(false),
});

export type CustomerInput = z.input<typeof customerSchema>;

export const createBookingSchema = z.object({
  staffTreatmentId: uuid,
  startsAt: isoDateTime,
  customer: customerSchema,
  idempotencyKey: z.string().uuid(),
  /** Honeypot – skal være tom. */
  company: z.string().max(0).optional().default(""),
});

export const daysSchema = z.object({
  staffTreatmentId: uuid,
  from: dateString,
  count: z.number().int().min(1).max(21),
});

export const slotsSchema = z.object({ staffTreatmentId: uuid, date: dateString });

export const tokenSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Ugyldigt link."),
});

export const managedSlotsSchema = tokenSchema.extend({ date: dateString });

export const managedDaysSchema = tokenSchema.extend({
  from: dateString,
  count: z.number().int().min(1).max(21),
});

export const rescheduleByTokenSchema = tokenSchema.extend({ startsAt: isoDateTime });
