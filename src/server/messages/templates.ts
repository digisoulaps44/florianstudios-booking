/**
 * Indhold til alle beskeder – dansk, kort og konkret. Samme data bruges til mail, WhatsApp og push.
 * Beskeder dannes ved afsendelse ud fra bookingens AKTUELLE tilstand (ikke da jobbet blev oprettet).
 */
import { formatDuration, formatPrice, formatWhen } from "@/lib/format";

export type MessageData = {
  customerName: string;
  treatmentName: string;
  staffName: string;
  startsAt: Date;
  durationMinutes: number;
  priceOre: number;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  cutoffHours: number;
  manageUrl: string | null;
  staffUrl: string;
};

export type EmailContent = {
  subject: string;
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  footer: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function customerEmail(template: string, d: MessageData): EmailContent {
  const when = formatWhen(d.startsAt);
  const details = [
    `${d.treatmentName} · ${formatDuration(d.durationMinutes)} · ${formatPrice(d.priceOre)}`,
    `Frisør: ${d.staffName}`,
    `Tid: ${when}`,
    `Adresse: ${d.salonName}, ${d.salonAddress}`,
  ];
  const manage = d.manageUrl ? { label: "Ændr eller aflys", url: d.manageUrl } : undefined;
  const footer = `${d.salonName} · ${d.salonAddress} · ${d.salonPhone}`;
  switch (template) {
    case "booking_confirmed":
      return {
        subject: `Din tid er booket – ${when}`,
        heading: `Tak, ${firstName(d.customerName)}. Vi ses ${when.toLowerCase()}.`,
        lines: [
          ...details,
          `Du kan ændre eller aflyse online frem til ${d.cutoffHours} timer før.`,
        ],
        ...(manage ? { cta: manage } : {}),
        footer,
      };
    case "booking_changed":
      return {
        subject: `Din tid er flyttet – ${when}`,
        heading: `Din tid er flyttet til ${when.toLowerCase()}.`,
        lines: [...details, "Den tidligere tid er frigivet."],
        ...(manage ? { cta: manage } : {}),
        footer,
      };
    case "booking_cancelled":
      return {
        subject: `Din tid er aflyst – ${when}`,
        heading: "Din booking er aflyst.",
        lines: [
          `${d.treatmentName} hos ${d.staffName}, ${when}.`,
          "Book en ny tid, når det passer dig.",
        ],
        cta: { label: "Book ny tid", url: new URL("/", d.staffUrl).toString() },
        footer,
      };
    case "booking_reminder":
      return {
        subject: `Påmindelse: ${when}`,
        heading: `Vi ses ${when.toLowerCase()}.`,
        lines: [
          ...details,
          `Kan du ikke komme? Ændr eller aflys senest ${d.cutoffHours} timer før – ellers ring på ${d.salonPhone}.`,
        ],
        ...(manage ? { cta: manage } : {}),
        footer,
      };
    default:
      throw new Error(`Ukendt kundeskabelon: ${template}`);
  }
}

export function staffEmail(template: string, d: MessageData): EmailContent {
  const when = formatWhen(d.startsAt);
  const what = `${d.customerName} · ${d.treatmentName} · ${when}`;
  const subject =
    template === "staff_booking_confirmed"
      ? `Ny booking: ${what}`
      : template === "staff_booking_changed"
        ? `Booking flyttet: ${what}`
        : `Booking aflyst: ${what}`;
  const heading =
    template === "staff_booking_confirmed"
      ? "Ny booking."
      : template === "staff_booking_changed"
        ? "En kunde har flyttet sin tid."
        : "En kunde har aflyst.";
  return {
    subject,
    heading,
    lines: [
      what,
      `Medarbejder: ${d.staffName}`,
      `${formatDuration(d.durationMinutes)} · ${formatPrice(d.priceOre)}`,
    ],
    cta: { label: "Åbn bookingen", url: d.staffUrl },
    footer: `${d.salonName} – medarbejderbesked`,
  };
}

export function pushContent(
  template: string,
  d: MessageData,
): { title: string; body: string; url: string } {
  const title =
    template === "staff_booking_confirmed"
      ? "Ny booking"
      : template === "staff_booking_changed"
        ? "Booking flyttet"
        : "Booking aflyst";
  return {
    title,
    body: `${d.customerName} · ${d.treatmentName} · ${formatWhen(d.startsAt)}`,
    url: new URL(d.staffUrl).pathname,
  };
}

/**
 * WhatsApp-skabeloner (skal godkendes af Meta, se docs/whatsapp-skabeloner.md).
 * Parametrene udfyldes i rækkefølge: {{1}} navn, {{2}} behandling, {{3}} frisør, {{4}} tid, {{5}} link.
 */
export const WHATSAPP_TEMPLATES: Record<string, string> = {
  booking_confirmed: "booking_bekraeftelse",
  booking_changed: "booking_aendring",
  booking_cancelled: "booking_aflysning",
  booking_reminder: "booking_paamindelse",
};

export function whatsappParams(d: MessageData): string[] {
  return [
    firstName(d.customerName),
    d.treatmentName,
    d.staffName,
    formatWhen(d.startsAt),
    d.manageUrl ?? d.salonPhone,
  ];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Enkel, tilgængelig HTML-mail (lys baggrund, sort knap – læselig i alle mailklienter). */
export function renderEmailHtml(c: EmailContent): string {
  const cta = c.cta
    ? `<p style="margin:28px 0 0"><a href="${esc(c.cta.url)}" style="display:inline-block;background:#010101;color:#dad7d2;text-decoration:none;font:500 13px/1 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;padding:16px 28px">${esc(c.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;background:#f4f3f1;color:#010101">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
<tr><td style="background:#010101;padding:20px 28px;font:400 15px/1 Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;color:#dad7d2">Florian Studios</td></tr>
<tr><td style="padding:32px 28px">
<h1 style="margin:0 0 20px;font:700 26px/1.2 Georgia,'Times New Roman',serif;color:#010101">${esc(c.heading)}</h1>
${c.lines.map((l) => `<p style="margin:0 0 8px;font:400 16px/1.5 Arial,sans-serif;color:#2b2b2b">${esc(l)}</p>`).join("\n")}
${cta}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e3e1dd;font:400 13px/1.5 Arial,sans-serif;color:#5c5c5c">${esc(c.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmailText(c: EmailContent): string {
  return [
    c.heading,
    "",
    ...c.lines,
    ...(c.cta ? ["", `${c.cta.label}: ${c.cta.url}`] : []),
    "",
    c.footer,
  ].join("\n");
}
