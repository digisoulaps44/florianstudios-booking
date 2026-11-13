# WhatsApp-skabeloner (til Meta-godkendelse)

Beskeder uden for 24-timers-vinduet må kun sendes som Meta-godkendte skabeloner. Opret dem via Lovable (WhatsApp Business-connectoren), sprog **dansk (da)**, kategori **Utility**. Navnene skal matche `WHATSAPP_TEMPLATES` i `src/server/messages/templates.ts`.

Parametre (samme rækkefølge i alle): `{{1}}` fornavn · `{{2}}` behandling · `{{3}}` frisør · `{{4}}` tid · `{{5}}` link til at ændre/aflyse.

| Navn | Tekst |
|---|---|
| `booking_bekraeftelse` | Hej {{1}}. Din tid er booket: {{2}} hos {{3}}, {{4}}. Ændr eller aflys her: {{5}} – Florian Studios, Toggangen 1, Herlev |
| `booking_paamindelse` | Hej {{1}}. Påmindelse: {{2}} hos {{3}}, {{4}}. Kan du ikke komme? Ændr eller aflys her: {{5}} |
| `booking_aendring` | Hej {{1}}. Din tid er flyttet: {{2}} hos {{3}}, {{4}}. Se din booking her: {{5}} |
| `booking_aflysning` | Hej {{1}}. Din tid er aflyst: {{2}} hos {{3}}, {{4}}. Book en ny tid, når det passer dig: {{5}} |

- Modtagernummeret sendes som cifre med landekode uden `+` (fx `4512345678`).
- WhatsApp er ikke SMS. Kunder uden WhatsApp-tilvalg får kun mail.
- Leveringsstatus (sendt, leveret, læst, fejlet) skal opdatere `message_jobs` ud fra `provider_message_id`.
