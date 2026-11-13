import { describe, expect, it } from "vitest";

import {
  computeSlots,
  mergeIntervals,
  subtractIntervals,
  workingWindows,
  type WeeklyRow,
} from "./availability";
import { formatPrice, formatTime } from "./format";
import { normalizePhone, toWhatsAppRecipient } from "./phone";
import { generateToken, hashToken, isWellFormedToken } from "./token";
import {
  addDays,
  dayBounds,
  isoWeekday,
  localDate,
  localTime,
  tzOffsetMinutes,
  zonedToUtc,
} from "./tz";

const iso = (s: string) => new Date(s);
const hhmm = (dates: Date[]) => dates.map((d) => localTime(d));

// Mandag–fredag 10–18 med frokostpause 12:30–13:00, lørdag 10–17.
const WEEK: WeeklyRow[] = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, kind: "work" as const, start_time: "10:00:00", end_time: "18:00:00" },
    { weekday, kind: "break" as const, start_time: "12:30:00", end_time: "13:00:00" },
  ]),
  { weekday: 6, kind: "work", start_time: "10:00:00", end_time: "17:00:00" },
];

const base = {
  weekly: WEEK,
  exceptions: [],
  busy: [],
  durationMinutes: 30,
  bufferMinutes: 0,
  slotIntervalMinutes: 30,
  now: iso("2026-01-01T00:00:00Z"),
  minNoticeMinutes: 60,
};

describe("tz – Europe/Copenhagen", () => {
  it("vintertid er UTC+1 og sommertid UTC+2", () => {
    expect(tzOffsetMinutes(iso("2026-01-15T12:00:00Z"))).toBe(60);
    expect(tzOffsetMinutes(iso("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("omregner lokal vægtid til UTC på begge sider af forårsskiftet (29. marts 2026)", () => {
    expect(zonedToUtc("2026-03-28", "10:00").toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(zonedToUtc("2026-03-30", "10:00").toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  it("flytter en ikke-eksisterende tid (02:30 ved forårsskift) frem til 03:30", () => {
    const d = zonedToUtc("2026-03-29", "02:30");
    expect(localTime(d)).toBe("03:30");
  });

  it("vælger første forekomst af en dobbelt tid (02:30 ved efterårsskift 25. oktober 2026)", () => {
    expect(zonedToUtc("2026-10-25", "02:30").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("dage ved tidsskift er 23 og 25 timer lange", () => {
    const spring = dayBounds("2026-03-29");
    const autumn = dayBounds("2026-10-25");
    expect((spring.end.getTime() - spring.start.getTime()) / 3600_000).toBe(23);
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3600_000).toBe(25);
  });

  it("kalenderhjælpere", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoWeekday("2026-11-13")).toBe(5); // fredag
    expect(isoWeekday("2026-11-15")).toBe(7); // søndag
    expect(localDate(iso("2026-11-13T23:30:00Z"))).toBe("2026-11-14"); // 00:30 lokal tid
  });
});

describe("ledige tider", () => {
  it("følger arbejdstid og pause", () => {
    const slots = computeSlots({ ...base, date: "2026-11-16" }); // mandag
    expect(hhmm(slots)).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
    ]);
  });

  it("søndag uden arbejdstid giver ingen tider", () => {
    expect(computeSlots({ ...base, date: "2026-11-15" })).toEqual([]);
  });

  it("en behandling på 45 min skal kunne nås før pause og lukketid", () => {
    const slots = computeSlots({
      ...base,
      date: "2026-11-16",
      durationMinutes: 45,
      slotIntervalMinutes: 15,
    });
    const times = hhmm(slots);
    expect(times).toContain("11:45"); // 11:45–12:30 slutter præcis ved pausen
    expect(times).not.toContain("12:00"); // ville ramme pausen
    expect(times).toContain("17:15"); // 17:15–18:00
    expect(times).not.toContain("17:30");
  });

  it("buffer blokerer tiden efter en eksisterende booking", () => {
    // Eksisterende booking 10:00–10:30 + 15 min buffer → blokeret til 10:45.
    const busy = [
      { start: zonedToUtc("2026-11-16", "10:00"), end: zonedToUtc("2026-11-16", "10:45") },
    ];
    const slots = computeSlots({ ...base, date: "2026-11-16", busy, slotIntervalMinutes: 15 });
    const times = hhmm(slots);
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:30");
    expect(times).toContain("10:45");
  });

  it("den nye behandlings egen buffer må ikke ramme næste booking", () => {
    const busy = [
      { start: zonedToUtc("2026-11-16", "11:00"), end: zonedToUtc("2026-11-16", "11:30") },
    ];
    const slots = computeSlots({
      ...base,
      date: "2026-11-16",
      busy,
      bufferMinutes: 10,
      slotIntervalMinutes: 15,
    });
    const times = hhmm(slots);
    expect(times).toContain("10:15"); // 10:15–10:45 + 10 min = 10:55 < 11:00
    expect(times).not.toContain("10:30"); // 10:30–11:00 + 10 min overlapper 11:00
  });

  it("ferie fjerner hele dagen, blokering kun et tidsrum", () => {
    const vacation = {
      kind: "vacation" as const,
      starts_at: zonedToUtc("2026-11-16", "00:00"),
      ends_at: zonedToUtc("2026-11-23", "00:00"),
    };
    expect(computeSlots({ ...base, date: "2026-11-18", exceptions: [vacation] })).toEqual([]);

    const block = {
      kind: "block" as const,
      starts_at: zonedToUtc("2026-11-16", "14:00"),
      ends_at: zonedToUtc("2026-11-16", "15:00"),
    };
    const times = hhmm(computeSlots({ ...base, date: "2026-11-16", exceptions: [block] }));
    expect(times).not.toContain("14:00");
    expect(times).not.toContain("14:30");
    expect(times).toContain("15:00");
  });

  it("ekstra arbejdstid åbner en ellers lukket søndag", () => {
    const extra = {
      kind: "extra_work" as const,
      starts_at: zonedToUtc("2026-11-15", "11:00"),
      ends_at: zonedToUtc("2026-11-15", "13:00"),
    };
    expect(hhmm(computeSlots({ ...base, date: "2026-11-15", exceptions: [extra] }))).toEqual([
      "11:00",
      "11:30",
      "12:00",
      "12:30",
    ]);
  });

  it("respekterer varsel – ingen tider tættere på end min_notice", () => {
    const now = zonedToUtc("2026-11-16", "13:10");
    const times = hhmm(computeSlots({ ...base, date: "2026-11-16", now }));
    expect(times[0]).toBe("14:30"); // 13:10 + 60 min = 14:10 → næste gittertid 14:30
  });

  it("samme lokale arbejdstid før og efter forårsskiftet", () => {
    const before = computeSlots({ ...base, date: "2026-03-27" }); // fredag, vintertid
    const after = computeSlots({ ...base, date: "2026-03-30" }); // mandag, sommertid
    expect(hhmm(before)).toEqual(hhmm(after));
    expect(before[0]!.toISOString()).toBe("2026-03-27T09:00:00.000Z");
    expect(after[0]!.toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  it("efterårsskiftet (søndag 25. oktober) med ekstra tid giver ingen dubletter", () => {
    const extra = {
      kind: "extra_work" as const,
      starts_at: zonedToUtc("2026-10-25", "00:00"),
      ends_at: zonedToUtc("2026-10-25", "04:00"),
    };
    const slots = computeSlots({
      ...base,
      date: "2026-10-25",
      exceptions: [extra],
      now: iso("2026-10-01T00:00:00Z"),
    });
    const unique = new Set(slots.map((s) => s.getTime()));
    expect(unique.size).toBe(slots.length);
  });

  it("interval-hjælpere", () => {
    const a = { start: iso("2026-01-01T10:00:00Z"), end: iso("2026-01-01T12:00:00Z") };
    const b = { start: iso("2026-01-01T11:00:00Z"), end: iso("2026-01-01T13:00:00Z") };
    expect(mergeIntervals([a, b])).toEqual([{ start: a.start, end: b.end }]);
    expect(subtractIntervals([a], [b])).toEqual([{ start: a.start, end: b.start }]);
    expect(workingWindows({ date: "2026-11-15", weekly: WEEK, exceptions: [] })).toEqual([]);
  });
});

describe("format, telefon og tokens", () => {
  it("priser og tider på dansk", () => {
    expect(formatPrice(25000)).toBe("250 kr.");
    expect(formatPrice(12550)).toBe("125,5 kr.");
    expect(formatTime(iso("2026-07-15T08:30:00Z"))).toBe("10:30");
  });

  it("normaliserer telefonnumre", () => {
    expect(normalizePhone("12 34 56 78")).toBe("+4512345678");
    expect(normalizePhone("+45 12345678")).toBe("+4512345678");
    expect(normalizePhone("004512345678")).toBe("+4512345678");
    expect(normalizePhone("+46701234567")).toBe("+46701234567");
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("+451234")).toBeNull();
    expect(toWhatsAppRecipient("+4512345678")).toBe("4512345678");
  });

  it("tokens er uforudsigelige og gemmes som hash", async () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(await hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken(a)).toBe(await hashToken(a));
  });
});
