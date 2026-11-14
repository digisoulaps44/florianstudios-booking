import { describe, expect, it } from "vitest";

import { publicOrigin } from "./public-url";

const fallback = "https://blank-canvas-preview.lovable.app";

describe("publicOrigin", () => {
  it("bruger den faste adresse, når den er sat", () => {
    expect(publicOrigin(fallback, "https://book.florianstudio.dk")).toBe(
      "https://book.florianstudio.dk",
    );
  });

  it("fjerner sti og afsluttende skråstreg", () => {
    expect(publicOrigin(fallback, " https://book.florianstudio.dk/app/ ")).toBe(
      "https://book.florianstudio.dk",
    );
  });

  it("falder tilbage, når den mangler, er tom, ugyldig eller ikke https", () => {
    expect(publicOrigin(fallback, undefined)).toBe(fallback);
    expect(publicOrigin(fallback, "  ")).toBe(fallback);
    expect(publicOrigin(fallback, "book.florianstudio.dk")).toBe(fallback);
    expect(publicOrigin(fallback, "http://book.florianstudio.dk")).toBe(fallback);
  });
});
