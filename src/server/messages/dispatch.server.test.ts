import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchBookingMessages } from "./dispatch.server";
import { runMessageWorker } from "./worker.server";

vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestUrl: () => new URL("https://booking.example.com"),
}));
vi.mock("./worker.server", () => ({ runMessageWorker: vi.fn() }));

describe("immediate booking dispatch", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://florianstudio.dk");
    vi.mocked(runMessageWorker).mockReset();
  });
  it("awaits the scoped worker before returning", async () => {
    let resolveWorker: (() => void) | undefined;
    vi.mocked(runMessageWorker).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWorker = () =>
            resolve({
              claimed: 1,
              sent: 1,
              retried: 0,
              failed: 0,
              cancelled: 0,
              waiting: 0,
              deferred: 0,
            });
        }),
    );
    let finished = false;
    const dispatch = dispatchBookingMessages("booking-123").then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(runMessageWorker).toHaveBeenCalledWith("https://florianstudio.dk", 6000, "booking-123");
    resolveWorker?.();
    await dispatch;
    expect(finished).toBe(true);
    vi.unstubAllEnvs();
  });
  it("does not fail the committed booking when queue dispatch is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(runMessageWorker).mockRejectedValue(new Error("Unavailable"));
    await expect(dispatchBookingMessages("booking-123")).resolves.toBeUndefined();
    log.mockRestore();
    vi.unstubAllEnvs();
  });
});
