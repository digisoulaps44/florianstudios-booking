/**
 * Offentlige serverfunktioner til kundens bookingflow. Selve logikken ligger i
 * src/server/public-booking.server.ts og indlæses kun på serveren.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  createBookingSchema,
  daysSchema,
  managedDaysSchema,
  managedSlotsSchema,
  rescheduleByTokenSchema,
  slotsSchema,
  tokenSchema,
  uuid,
} from "./booking-schemas";

const server = () => import("@/server/public-booking.server");

export const fetchCatalog = createServerFn({ method: "GET" }).handler(async () =>
  (await server()).getCatalog(),
);

export const fetchStaffOptions = createServerFn({ method: "GET" })
  .validator(z.object({ treatmentId: uuid }))
  .handler(async ({ data }) => (await server()).getStaffOptions(data.treatmentId));

export const fetchDays = createServerFn({ method: "GET" })
  .validator(daysSchema)
  .handler(async ({ data }) => (await server()).getDays(data));

export const fetchSlots = createServerFn({ method: "GET" })
  .validator(slotsSchema)
  .handler(async ({ data }) => (await server()).getSlots(data));

export const submitBooking = createServerFn({ method: "POST" })
  .validator(createBookingSchema)
  .handler(async ({ data }) => (await server()).createBooking(data));

export const fetchManagedBooking = createServerFn({ method: "GET" })
  .validator(tokenSchema)
  .handler(async ({ data }) => (await server()).getManagedBooking(data));

export const fetchManagedDays = createServerFn({ method: "GET" })
  .validator(managedDaysSchema)
  .handler(async ({ data }) => (await server()).getManagedDays(data));

export const fetchManagedSlots = createServerFn({ method: "GET" })
  .validator(managedSlotsSchema)
  .handler(async ({ data }) => (await server()).getManagedSlots(data));

export const submitReschedule = createServerFn({ method: "POST" })
  .validator(rescheduleByTokenSchema)
  .handler(async ({ data }) => (await server()).rescheduleByToken(data));

export const submitCancel = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => (await server()).cancelByToken(data));
