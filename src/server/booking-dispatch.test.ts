import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBooking } from "./public-booking.server";
import { retryMessage, staffCreateBooking } from "./staff.server";
import { dispatchBookingMessages } from "./messages/dispatch.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const fixtures = vi.hoisted(() => ({
  id: "9c3a479a-0666-4664-9668-381afe117130",
  st: { id: "staff-treatment", staff_id: "staff-123" },
  upsert: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => "test-ip",
  getRequestIP: () => "test-ip",
}));
vi.mock("@/lib/token", () => ({ hashToken: async () => "hash" }));
vi.mock("./links.server", () => ({
  bookingLinkToken: async () => "token",
  bookingLinkTokenHash: async () => "token-hash",
}));
vi.mock("./messages/dispatch.server", () => ({ dispatchBookingMessages: vi.fn() }));
vi.mock("./availability.server", () => ({
  loadBookableStaffTreatment: async () => fixtures.st,
  loadSettings: vi.fn(),
  slotsForDays: vi.fn(),
  bookableRange: vi.fn(),
  todayInSalon: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: fixtures.rpc,
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: () => chain,
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
        maybeSingle: async () => ({
          data:
            table === "bookings"
              ? {
                  id: fixtures.id,
                  treatment_name: "Test",
                  starts_at: "2026-12-01T12:00:00Z",
                  duration_minutes: 30,
                  price_ore: 10000,
                  status: "confirmed",
                  customer_name: "Test",
                  customer_email: "test@example.com",
                  whatsapp_opt_in: false,
                  staff: { display_name: "Test" },
                }
              : table === "message_jobs"
                ? { id: "job-123", status: "failed", booking_id: fixtures.id }
                : { id: "staff-123", active: true },
        }),
        upsert: fixtures.upsert,
      };
      return chain;
    },
  },
}));

const input = {
  staffTreatmentId: "staff-treatment",
  startsAt: "2026-12-01T12:00:00Z",
  customer: { name: "Test", phone: "+4512345678", email: "test@example.com", whatsappOptIn: false },
  idempotencyKey: "booking-key",
  company: "",
};

describe("booking creation delivery", () => {
  beforeEach(() => {
    vi.mocked(dispatchBookingMessages).mockReset();
    fixtures.upsert.mockReset().mockResolvedValue({ error: null });
    fixtures.rpc.mockReset().mockImplementation(async (name: string) => ({
      data: name === "hit_rate_limit" ? true : [{ booking_id: fixtures.id }],
      error: null,
    }));
  });

  it("dispatches online bookings after commit and link persistence, including idempotent replay", async () => {
    const result = await createBooking(input);
    expect(result.ok).toBe(true);
    expect(dispatchBookingMessages).toHaveBeenCalledWith(fixtures.id);
    expect(fixtures.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(dispatchBookingMessages).mock.invocationCallOrder[0] ?? 0,
    );
    await createBooking(input);
    expect(dispatchBookingMessages).toHaveBeenCalledTimes(2);
  });

  it("dispatches staff-created bookings through the same queue after link persistence", async () => {
    const ctx = {
      supabase: { from: supabaseAdmin.from, rpc: async () => ({ data: true }) },
      userId: "owner-123",
    };
    const result = await staffCreateBooking(
      ctx as unknown as Parameters<typeof staffCreateBooking>[0],
      {
        ...input,
        ignoreSchedule: true,
        note: "",
      },
    );
    expect(result.ok).toBe(true);
    expect(dispatchBookingMessages).toHaveBeenCalledWith(fixtures.id);
    expect(fixtures.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(dispatchBookingMessages).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("never dispatches if the booking transaction fails", async () => {
    fixtures.rpc.mockImplementation(async (name: string) => ({
      data: name === "hit_rate_limit" ? true : null,
      error: name === "hit_rate_limit" ? null : { code: "XX000", message: "transaction failure" },
    }));
    await expect(createBooking(input)).rejects.toThrow("create_booking");
    expect(dispatchBookingMessages).not.toHaveBeenCalled();
  });

  it("immediately dispatches owner-requested retries without waiting for the backstop", async () => {
    const ctx = {
      supabase: { from: supabaseAdmin.from, rpc: async () => ({ data: true }) },
      userId: "owner-123",
    };
    const result = await retryMessage(ctx as unknown as Parameters<typeof retryMessage>[0], {
      jobId: "job-123",
    });
    expect(result.ok).toBe(true);
    expect(dispatchBookingMessages).toHaveBeenCalledWith(fixtures.id);
  });
});
