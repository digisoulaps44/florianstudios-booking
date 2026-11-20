import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

import { publicOrigin } from "../public-url";
import { runMessageWorker } from "./worker.server";

/** Await delivery after commit; a channel outage must never undo a booking. */
export const dispatchBookingMessages = createServerOnlyFn(
  async (bookingId: string): Promise<void> => {
    try {
      await runMessageWorker(publicOrigin(getRequestUrl().origin), 6000, bookingId);
    } catch {
      // Jobs remain durable for the recovery schedule. Never log customer data.
      console.error("Booking message dispatch deferred", bookingId);
    }
  },
);
