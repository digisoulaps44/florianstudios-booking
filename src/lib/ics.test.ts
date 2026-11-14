import { describe, expect, it } from "vitest";

import { buildIcs } from "./ics";

const base = {
  uid: "abc",
  title: "Klip hos Florian Studios",
  start: new Date("2026-11-16T10:00:00Z"),
  end: new Date("2026-11-16T10:30:00Z"),
  location: "Florian Studios, Toggangen 1, 2730 Herlev",
  description: "Klip; hos Testejer\nLinje to",
};

describe("buildIcs", () => {
  it("bruger CRLF, UTC-tider og escaper komma, semikolon og linjeskift", () => {
    const ics = buildIcs(base);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n")).toContain("DTSTART:20261116T100000Z");
    expect(ics).toContain("LOCATION:Florian Studios\\, Toggangen 1\\, 2730 Herlev");
    expect(ics).toContain("DESCRIPTION:Klip\\; hos Testejer\\nLinje to");
    expect(ics).toContain("UID:abc@florianstudio.dk");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("tilføjer en påmindelse, når alarmMinutes er sat", () => {
    const ics = buildIcs({ ...base, alarmMinutes: 60, url: "https://x.dk/booking/t" });
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("URL:https://x.dk/booking/t");
  });

  it("markerer aflyste bookinger og springer påmindelsen over", () => {
    const ics = buildIcs({ ...base, alarmMinutes: 60, cancelled: true });
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("VALARM");
  });
});
