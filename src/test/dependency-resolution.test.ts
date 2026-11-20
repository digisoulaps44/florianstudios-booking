import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, loadConfigFromFile, type ViteDevServer } from "vite";

describe("email dependency resolution", () => {
  let server: ViteDevServer | undefined;

  beforeAll(async () => {
    const loaded = await loadConfigFromFile(
      { command: "build", mode: "development" },
      "vite.config.ts",
    );
    if (!loaded) throw new Error("Could not load project Vite configuration");
    server = await createServer({
      configFile: false,
      resolve: loaded.config.resolve ?? {},
      server: { middlewareMode: true },
      appType: "custom",
    });
  });

  afterAll(async () => {
    await server?.close();
  });

  it("loads htmlparser2 with its own entities decoder", async () => {
    if (!server) throw new Error("Vite server was not initialized");
    const parser = await server.ssrLoadModule("htmlparser2");
    let text = "";
    // Use the streaming parser API to exercise entity decoding directly.
    const Decoder = parser["Parser"];
    const decoder = new Decoder({ ontext: (value: string) => { text += value; } });
    decoder.end("<p>A &amp; B &#x1F642;</p>");
    expect(text).toBe("A & B 🙂");
  });

  it("loads React Email and converts encoded HTML to plain text", async () => {
    if (!server) throw new Error("Vite server was not initialized");
    const renderer = await server.ssrLoadModule("@react-email/render");
    const plainText = renderer["toPlainText"]("<p>A &amp; B &#x1F642;</p>");
    expect(plainText.trim()).toBe("A & B 🙂");
  });
});