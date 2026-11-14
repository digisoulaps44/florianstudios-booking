import { readFileSync } from "node:fs";
import path from "node:path";

import config, { PRODUCTION_URL } from "../../capacitor.config";

const root = path.resolve(__dirname, "../..");

describe("capacitor.config", () => {
  it("peger på en https-adresse uden sti og uden afsluttende skråstreg", () => {
    const url = new URL(PRODUCTION_URL);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/");
    expect(PRODUCTION_URL.endsWith("/")).toBe(false);
  });

  it("bruger produktionsadressen, når CAP_SERVER_URL ikke er sat", () => {
    expect(process.env["CAP_SERVER_URL"]).toBeUndefined();
    expect(config.server?.url).toBe(PRODUCTION_URL);
  });

  it("offline-sidens 'Prøv igen' går til samme adresse som appen", () => {
    const offline = readFileSync(path.join(root, "capacitor/www/offline.html"), "utf8");
    expect(offline).toContain(`const START_URL = "${PRODUCTION_URL}";`);
  });

  it("har de lokale filer, CLI'en og errorPath kræver", () => {
    const webDir = path.join(root, config.webDir ?? "");
    expect(readFileSync(path.join(webDir, "index.html"), "utf8")).toContain("<html");
    expect(config.server?.errorPath).toBe("offline.html");
    expect(readFileSync(path.join(webDir, "offline.html"), "utf8")).toContain("Prøv igen");
  });
});
