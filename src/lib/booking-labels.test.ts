import { describe, expect, it } from "vitest";

import { nextAvailableLabel, priceRangeLabel, treatmentCountLabel } from "./booking-labels";

describe("booking-labels", () => {
  it("viser én pris eller 'fra' når frisørens priser varierer", () => {
    expect(priceRangeLabel(25000, 25000)).toBe("250 kr.");
    expect(priceRangeLabel(10000, 25000)).toBe("fra 100 kr.");
  });

  it("bøjer antal behandlinger", () => {
    expect(treatmentCountLabel(1)).toBe("1 behandling");
    expect(treatmentCountLabel(4)).toBe("4 behandlinger");
  });

  it("siger i dag / i morgen i dansk tid og håndterer ingen ledige tider", () => {
    const now = new Date("2026-11-16T08:00:00Z"); // mandag kl. 9 i København
    expect(nextAvailableLabel("2026-11-16T10:00:00Z", now)).toBe("Første ledige: i dag 11:00");
    expect(nextAvailableLabel("2026-11-17T09:00:00Z", now)).toBe("Første ledige: i morgen 10:00");
    expect(nextAvailableLabel(null, now)).toBe("Ingen ledige tider de næste 3 uger");
  });
});
