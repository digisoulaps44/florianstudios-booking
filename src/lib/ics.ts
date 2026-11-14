/**
 * Kalenderfil (iCalendar) for en booking. Serveres fra /api/public/kalender/<token> som
 * text/calendar, så iPhone viser sit eget "Føj til kalender"-ark i stedet for en download.
 */
function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcs(opts: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  url?: string | undefined;
  cancelled?: boolean | undefined;
  /** Påmindelse i kalenderen, minutter før. */
  alarmMinutes?: number | undefined;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Florian Studios//Booking//DA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@florianstudio.dk`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(opts.end)}`,
    `SUMMARY:${escape(opts.title)}`,
    `LOCATION:${escape(opts.location)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    ...(opts.url ? [`URL:${opts.url}`] : []),
    `STATUS:${opts.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    ...(opts.alarmMinutes && !opts.cancelled
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escape(opts.title)}`,
          `TRIGGER:-PT${opts.alarmMinutes}M`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
