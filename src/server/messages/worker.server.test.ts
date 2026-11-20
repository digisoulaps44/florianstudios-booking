import { beforeEach, describe, expect, it, vi } from "vitest";
import { runMessageWorker } from "./worker.server";
import { sendEmail } from "./channels.server";
import { ChannelNotConfigured } from "./errors";

const state = vi.hoisted(() => ({ rpc: vi.fn(), patch: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: state.rpc,
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (patch: unknown) => {
          state.patch(patch);
          return chain;
        },
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
        maybeSingle: async () => ({
          data: {
            id: "booking-123",
            status: "confirmed",
            customer_name: "Test",
            customer_email: "test@example.com",
            whatsapp_opt_in: false,
            treatment_name: "Klip",
            starts_at: "2026-12-01T12:00:00Z",
            duration_minutes: 30,
            price_ore: 10000,
            staff: { display_name: "Test" },
          },
        }),
        single: async () => ({ data: { name: "Florian Studios", cancellation_cutoff_hours: 24 } }),
      };
      return chain;
    },
  },
}));
vi.mock("../links.server", () => ({ bookingLinkToken: async () => "token" }));
vi.mock("./channels.server", () => ({
  sendEmail: vi.fn(),
  sendPushToStaff: vi.fn(),
  sendWhatsApp: vi.fn(),
}));

const job = {
  id: "job-123",
  booking_id: "booking-123",
  channel: "email",
  template: "booking_confirmed",
  recipient_kind: "customer",
  recipient: "test@example.com",
  attempts: 1,
  max_attempts: 6,
};

describe("booking-scoped durable worker", () => {
  beforeEach(() => {
    state.rpc.mockReset().mockResolvedValue({ data: [job], error: null });
    state.patch.mockReset();
    vi.mocked(sendEmail).mockReset().mockResolvedValue({ providerMessageId: "provider-123" });
  });
  it("claims only this booking and preserves provider job-id idempotency", async () => {
    const report = await runMessageWorker("https://florianstudio.dk", 6000, "booking-123");
    expect(state.rpc).toHaveBeenCalledWith("claim_booking_message_jobs", {
      p_booking_id: "booking-123",
      p_limit: 20,
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "job-123" }));
    expect(report.sent).toBe(1);
    expect(state.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        provider_message_id: "provider-123",
        locked_at: null,
      }),
    );
  });
  it("does not resend when a concurrent or repeated call claims no jobs", async () => {
    state.rpc.mockResolvedValue({ data: [], error: null });
    expect((await runMessageWorker("https://florianstudio.dk", 6000, "booking-123")).sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("preserves exponential retry deadlines after transient delivery failures", async () => {
    const before = Date.now();
    vi.mocked(sendEmail).mockRejectedValue(new Error("Temporary outage"));
    expect((await runMessageWorker("https://florianstudio.dk", 6000, "booking-123")).retried).toBe(
      1,
    );
    const patch = state.patch.mock.calls[0]?.[0];
    expect(patch.status).toBe("pending");
    expect(patch.locked_at).toBeNull();
    expect(new Date(patch.scheduled_for).getTime()).toBeGreaterThanOrEqual(before + 2 * 60_000);
    expect(new Date(patch.scheduled_for).getTime()).toBeLessThanOrEqual(Date.now() + 2 * 60_000);
  });
  it("waits 15 minutes without consuming an attempt for unconfigured channels", async () => {
    const before = Date.now();
    vi.mocked(sendEmail).mockRejectedValue(new ChannelNotConfigured("Waiting"));
    expect((await runMessageWorker("https://florianstudio.dk", 6000, "booking-123")).waiting).toBe(
      1,
    );
    const patch = state.patch.mock.calls[0]?.[0];
    expect(patch.attempts).toBe(0);
    expect(new Date(patch.scheduled_for).getTime()).toBeGreaterThanOrEqual(before + 15 * 60_000);
  });
  it("keeps the global claim path for reminder and recovery callbacks", async () => {
    await runMessageWorker("https://florianstudio.dk", 6000);
    expect(state.rpc).toHaveBeenCalledWith("claim_message_jobs", { p_limit: 20 });
  });
});
