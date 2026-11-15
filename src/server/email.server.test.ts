import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { sendAppEmail } from "./email.server";
import { ChannelNotConfigured, PermanentSendError } from "./messages/errors";

vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("@lovable.dev/email-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lovable.dev/email-js")>()),
  sendLovableEmail: vi.fn(),
}));

const message = {
  to: "customer@example.com",
  subject: "Booking bekræftet",
  html: "<p>Din booking</p>",
  text: "Din booking",
  idempotencyKey: "booking-123-confirmation",
};

describe("sendAppEmail", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-only-key");
    vi.mocked(sendLovableEmail).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends rendered content unchanged with transactional purpose and provider idempotency", async () => {
    vi.mocked(sendLovableEmail).mockResolvedValue({ success: true, message_id: "provider-123" });
    await expect(sendAppEmail(message)).resolves.toEqual({ providerMessageId: "provider-123" });
    expect(sendLovableEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        purpose: "transactional",
        sender_domain: "notify.florianstudio.dk",
        idempotency_key: "booking-123-confirmation",
      }),
      expect.objectContaining({ idempotencyKey: "booking-123-confirmation" }),
    );
  });

  it.each(["domain_not_verified", "emails_disabled"])("waits when %s", async (code) => {
    vi.mocked(sendLovableEmail).mockRejectedValue(
      new EmailAPIError(403, "Unavailable", null, code),
    );
    await expect(sendAppEmail(message)).rejects.toBeInstanceOf(ChannelNotConfigured);
  });

  it("does not retry suppressed recipients", async () => {
    vi.mocked(sendLovableEmail).mockRejectedValue(
      new EmailAPIError(403, "Suppressed", null, "recipient_suppressed"),
    );
    await expect(sendAppEmail(message)).rejects.toBeInstanceOf(PermanentSendError);
    expect(sendLovableEmail).toHaveBeenCalledTimes(1);
  });

  it("waits without configured credentials", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    await expect(sendAppEmail(message)).rejects.toBeInstanceOf(ChannelNotConfigured);
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });
});
