import { describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/public/cron/messages";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runMessageWorker } from "@/server/messages/worker.server";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/integrations/supabase/cron-auth", () => ({ authenticateCronRequest: vi.fn() }));
vi.mock("@/server/messages/worker.server", () => ({ runMessageWorker: vi.fn() }));

describe("managed message callback", () => {
  it("rejects unauthenticated version checks without claiming or sending customer jobs", async () => {
    vi.mocked(authenticateCronRequest).mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const handlers = Route.options.server?.handlers;
    if (!handlers || typeof handlers === "function") throw new Error("Static handlers missing");
    const handler = handlers.POST;
    if (typeof handler !== "function") throw new Error("POST handler missing");
    const response = await handler({
      request: new Request("https://florianstudio.dk/api/public/cron/messages", { method: "POST" }),
    } as Parameters<typeof handler>[0]);
    if (!(response instanceof Response)) throw new Error("Response missing");
    expect(response.status).toBe(401);
    expect(runMessageWorker).not.toHaveBeenCalled();
  });
});
