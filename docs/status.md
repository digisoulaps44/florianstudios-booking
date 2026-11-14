# Status – Florian Studios booking

Opdateret: 14. november 2026. Tre kategorier holdes skarpt adskilt: **implementeret**, **testet** og **afventer ekstern opsætning**.

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
- **Databasen direkte (13/11):** to samtidige bookinger på samme tid → én lykkes, én afvises med 23P01; booking inde i en andens buffer afvises, lige efter accepteres; gentagen idempotensnøgle giver samme booking; flyt til optaget tid afvises og originalen bevares uden historikpost; kundens aflysning inden for fristen afvises (`cutoff_passed`); ingen påmindelse for bookinger under 24 t ude; påmindelse annulleres ved aflysning.
- **Udgivet app på mobil, 375 px (13/11, https://blank-canvas-preview.lovable.app):** alle 5 trin; ledige tider respekterer arbejdstid, pause og varsel; feltvalidering med fokus på første fejl; booking oprettet; bekræftelsesside; sikkert link viser "for sent" inden for fristen; flyt og aflys via link; cron-workeren behandler køen hvert minut og lader mail/WhatsApp/push vente med "Afventer opsætning" uden at bruge forsøg; påmindelse annulleres ved flytning tæt på tiden; cron-ruten afviser kald uden hemmelighed (401). Fund rettet: datostrimlen gjorde "Flyt tid" bredere end skærmen, stort bogstav midt i sætning, tom bundbjælke uden behandlinger. Testdata slettet.

- **Medarbejder- og ejerappen live på mobil, 375 px (14/11, midlertidig ejerkonto):** behandling med pris, varighed og buffer; ugentlige arbejdstider med pause; ny booking fra salonen; overlap afvist af databasen; "I dag" med næste kunde, ledige huller og pause; flyt tid; gennemført og fortryd status; kundebooking giver realtime-notifikation og ulæst-mærke, notifikationen åbner bookingen og markeres læst; aflys fra salonen lægger aflysningsmail i kø; dag- og ugekalender; medarbejdersiden; salonindstillinger; fejlede beskeder. Push-nøglerne er aktive (krævede ny udgivelse), og arbejderen annullerer push uden abonnementer. Fund rettet (commit `1f1af7b`): svar på handlinger stod uden for skærmen og fokus forsvandt; salonindstillinger viste rå databasefejl; tom invitation gav generel fejl; "Behandling" manglede label; "Flyt tid"/"Aflys" tog ikke fokus; stort bogstav i "flyttet til"; interne skabelonnavne i beskedlisten; aflyste bookinger i ugevisningen kun gennemstreget. Testdata slettet.

**Ikke testet endnu:** invitation af en rigtig medarbejder og rolleadgang med flere brugere (medarbejder A må ikke se B's bookinger), push på rigtige enheder, mail og WhatsApp (afventer opsætning).

## Afventer ekstern opsætning

| Hvad | Hvem | Hvordan |
|---|---|---|
| Ejerkonto | Ejer + Claude | Midlertidig: udviklerens konto er ejer under test (medarbejderprofil "Testejer"). Når testen er færdig: Florian inviteres (More → Users eller Medarbejdere i appen), får rollen `owner`, og testkontoens roller og profil fjernes. |
| Lukket tilmelding | Ejer | More → Users → Auth settings: slå **Disable sign-up** til (invitationer og login virker stadig). Uinviterede konti får alligevel ingen adgang. |
| Afsenderdomæne til mail | Ejer | More → Emails → `notify.florianstudio.dk` → DNS-poster hos domæneudbyderen (op til 72 t). Derefter implementerer Lovable `sendAppEmail` i `src/server/email.server.ts`. Lovable tilføjer en obligatorisk afmeldingsfod. |
| Linkhemmelighed | Lovable | Secret `BOOKING_LINK_SECRET` (mindst 32 tegn; valgfri – ellers afledes den af service-nøglen). |
| Cron-job | Lovable | Hvert minut: `POST /api/public/cron/messages` med `LOVABLE_CRON_SECRET`. Når kun den udgivne app – kræver publish. |
| WhatsApp Business | Ejer + Lovable | Forbind connectoren (Meta Embedded Signup), opret skabelonerne i `docs/whatsapp-skabeloner.md`, byg afsender + statusmodtager, vælg projektet under Incoming messages. |
| Data | Ejer | Arbejdstider og behandlinger for hver medarbejder (i appen). |

Udført: tabelrettigheder strammet (migration `0001_tighten_booking_table_privileges`, 294 rettighedstjek verificeret af Lovable). Push-nøgler (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) er sat 14/11 – nye secrets kræver en ny udgivelse, før appen ser dem.

## Næste test

1. To samtidige `create_booking` på overlappende tider → én lykkes, én får 23P01.
2. Flyt til optaget tid → original bevares.
3. Medarbejder A kan ikke læse B's bookinger (RLS).
4. Kundelink efter fristen → afvist i databasen.
5. Påmindelse annulleres ved aflysning og flyttes ved flytning.
6. Mobil: hele flowet på 375 px, PWA-installation og push på iPhone og Android.
