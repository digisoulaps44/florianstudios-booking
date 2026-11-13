# Status – Florian Studios booking

Opdateret: 13. november 2026. Tre kategorier holdes skarpt adskilt: **implementeret**, **testet** og **afventer ekstern opsætning**.

## Implementeret

**Database (Lovable Cloud, migration `0000_florian_studios_booking_schema_v1`)**
- 14 tabeller med RLS på alle. Ingen anon-adgang; offentlige sider læser via serverfunktioner.
- Dobbeltbooking blokeres atomisk: `EXCLUDE USING gist (staff_id, tstzrange(starts_at, blocked_until))` for ikke-aflyste bookinger – inkl. buffer.
- `create_booking`, `reschedule_booking`, `cancel_booking`, `set_booking_status` skriver booking, historik, beskedjobs og notifikationer i én transaktion. Idempotensnøgle mod dobbeltklik. Afbestillingsfristen håndhæves i databasen for kunder.
- Pris og varighed gemmes på bookingen. Påmindelser planlægges/annulleres ved oprettelse, flytning og aflysning; forældede påmindelser springes over.
- Realtime på `bookings` og `notifications`.

**Kundens bookingflow** (`/`, `/frisor`, `/tid`, `/oplysninger`, `/gennemse`, `/booking/<token>`)
- 5 trin uden login: behandling → frisør (med pris, varighed, første ledige tid) → dato og kun reelt ledige tider → navn/mobil/mail + WhatsApp-tilvalg → gennemse og bekræft.
- Bekræftelse med "Tilføj til kalender" (.ics). Sikkert link til at flytte eller aflyse (HMAC-token, kun hash i databasen).
- Hvis tiden bliver taget: forståelig besked + opdaterede tider samme dag. Kundens oplysninger bevares.
- Rate limiting pr. IP (og pr. telefonnummer ved booking), honeypot, zod-validering på serveren.

**Medarbejder- og ejerapp** (`/login`, `/app/*`, installerbar PWA)
- I dag med "Næste kunde", ledige huller, pauser, "nu"-linje og konflikter. Dag/uge-kalender (ejer: alle eller én medarbejder).
- Ny booking (ledige tider eller fri tid uden for arbejdstid), flyt, aflys, gennemført/udeblevet, historik.
- Egne ugentlige arbejdstider, pauser, ferie, fravær, blokeringer og ekstra tider. Ændringer flytter aldrig bookinger – konflikter vises.
- Egne behandlinger, priser, varigheder og buffer.
- Notifikationscenter med læst/ulæst (virker uden push). Mail-/push-valg pr. medarbejder; ejeren kan tilvælge alle bookinger.
- Ejer: invitér/deaktivér medarbejdere, salonindstillinger (frist, påmindelse, bookingvindue, interval, varsel), fejlede beskeder med "Send igen".

**Beskeder**
- Vedvarende kø (`message_jobs`) + arbejder (`/api/public/cron/messages`) med låsning (`SKIP LOCKED`), idempotens, eksponentiel backoff, permanente fejl og "afventer opsætning".
- Danske skabeloner til mail (kunde + medarbejder), WhatsApp og push.
- Web push (RFC 8291/8292) med WebCrypto, service worker, iPhone-vejledning, håndtering af afviste tilladelser og udløbne abonnementer.

## Testet

- `src/lib/availability.test.ts` (20 tests): sommer-/vintertid (29. marts og 25. oktober 2026), arbejdstid og pauser, varigheder, buffer før og efter, ferie, blokeringer, ekstra tid, varsel, ingen dubletter ved tidsskift, telefonnumre, tokens.
- `src/server/messages/webpush.test.ts`: kryptering dekrypteres korrekt af en uafhængig brugeragent-implementering; VAPID-JWT verificeres.
- Databasens schema er verificeret af Lovable efter migrationen (constraint, trigger, tabeller, funktioner).

**Ikke testet endnu (kræver kørende miljø med data):** samtidige bookinger mod databasen, rolleadgang med rigtige brugere, flyt/aflys via link, påmindelser ved flyt/aflys, push på rigtige enheder, mobilvisning i appen. Se "Næste test" nedenfor.

## Afventer ekstern opsætning

| Hvad | Hvem | Hvordan |
|---|---|---|
| Ejerkonto | Ejer + Claude | Florian inviteres i Lovable (More → Users), vælger adgangskode via linket; derefter tildeles rollen `owner` og en medarbejderprofil. |
| Lukket tilmelding | Ejer | More → Users → Auth settings: slå **Disable sign-up** til (invitationer og login virker stadig). Uinviterede konti får alligevel ingen adgang. |
| Afsenderdomæne til mail | Ejer | More → Emails → `notify.florianstudio.dk` → DNS-poster hos domæneudbyderen (op til 72 t). Derefter implementerer Lovable `sendAppEmail` i `src/server/email.server.ts`. Lovable tilføjer en obligatorisk afmeldingsfod. |
| Push-nøgler | Ejer | `VAPID_PUBLIC_KEY` og `VAPID_PRIVATE_KEY` i Project Settings → Secrets (genereret lokalt af Claude). `VAPID_SUBJECT` er sat. |
| Linkhemmelighed | Lovable | Secret `BOOKING_LINK_SECRET` (mindst 32 tegn; valgfri – ellers afledes den af service-nøglen). |
| Cron-job | Lovable | Hvert minut: `POST /api/public/cron/messages` med `LOVABLE_CRON_SECRET`. Når kun den udgivne app – kræver publish. |
| WhatsApp Business | Ejer + Lovable | Forbind connectoren (Meta Embedded Signup), opret skabelonerne i `docs/whatsapp-skabeloner.md`, byg afsender + statusmodtager, vælg projektet under Incoming messages. |
| Data | Ejer | Arbejdstider og behandlinger for hver medarbejder (i appen). |

Udført: tabelrettigheder strammet (migration `0001_tighten_booking_table_privileges`, 294 rettighedstjek verificeret af Lovable).

## Næste test

1. To samtidige `create_booking` på overlappende tider → én lykkes, én får 23P01.
2. Flyt til optaget tid → original bevares.
3. Medarbejder A kan ikke læse B's bookinger (RLS).
4. Kundelink efter fristen → afvist i databasen.
5. Påmindelse annulleres ved aflysning og flyttes ved flytning.
6. Mobil: hele flowet på 375 px, PWA-installation og push på iPhone og Android.
