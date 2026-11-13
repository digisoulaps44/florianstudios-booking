# Implementeringsplan – Florian Studios booking

Bygget efter bookingbriefen og design systemet "Florian Studios" (https://claude.ai/artifact/Mh6m5ztZFR81UrCms7gSBK).

## Rammer

- **Stack:** TanStack Start + Lovable Cloud (Postgres, Auth, Cron) – projektets eksisterende skabelon. Ingen ekstra database, auth- eller mailudbyder.
- **Arbejdsdeling:** Databaseskema, RLS og connectors ændres via Lovable (jf. `AGENTS.md`). Appkoden skrives i repoet og pushes til `main`.
- **Tid:** Alle tidspunkter gemmes som `timestamptz` (UTC) og vises/beregnes i `Europe/Copenhagen` (`src/lib/tz.ts`), så sommer-/vintertid håndteres ét sted.
- **Design:** Mørkt system fra hjemmesiden – ink/bone, Playfair Display + Inter, radius 0, hairlines. Al tekst på dansk.

## Datamodel (Lovable Cloud)

| Tabel | Formål |
|---|---|
| `salon_settings` | Én række: navn, adresse, afbestillingsfrist, påmindelsestidspunkt, bookinghorisont, tidsinterval |
| `staff`, `user_roles` | Medarbejderprofiler (inviteres pr. mail) og roller `owner`/`staff` |
| `treatments`, `staff_treatments` | Fælles behandlingskatalog + hver medarbejders egen pris, varighed og buffer |
| `weekly_schedule`, `schedule_exceptions` | Ugentlige arbejdstider/pauser + ferie, fravær, blokeringer og ekstra tider |
| `bookings`, `booking_events` | Booking med pris/varighed gemt på bookingen + historik. Kundens kontakt og WhatsApp-tilvalg (med tidspunkt) ligger på bookingen |
| `booking_tokens` | Hash af kundens sikre link (ændr/aflys) med udløb |
| `message_jobs` | Vedvarende beskedkø: mail, WhatsApp, push (SMS forberedt, ikke aktiv) med status, forsøg og dedupe-nøgle |
| `notifications`, `push_subscriptions` | Notifikationscenter (læst/ulæst) og web push-abonnementer |
| `rate_limits` | Begrænsning af offentlige kald |

**Dobbeltbooking** forhindres i databasen med en `EXCLUDE USING gist`-constraint på `(staff_id, tstzrange(starts_at, blocked_until))` for ikke-aflyste bookinger – inkl. buffer. Oprettelse, flytning og aflysning sker i Postgres-funktioner, der i samme transaktion skriver booking, historik og beskedjobs. En idempotensnøgle pr. bekræftelse gør gentagne klik ufarlige. Fejler en flytning, ruller hele transaktionen tilbage, og den oprindelige tid bevares.

## Adgang

- Offentlige kald (katalog, ledige tider, booking, sikkert link) går gennem serverfunktioner, der kun returnerer nødvendige felter, validerer input med zod og rate-limiter pr. IP.
- Medarbejder-/ejerkald kræver login (`requireSupabaseAuth`). Læsning sker med brugerens egen klient under RLS; skrivning via serverfunktioner, der først tjekker adgang og derefter kalder databasefunktionerne.
- RLS: medarbejdere ser kun egne bookinger, arbejdstider og notifikationer; ejeren ser alt. Beskedkø og tokens kan kun tilgås af serveren.

## Rækkefølge

1. **Fundament** – design-tokens, fonte, app-skal, tidszone- og tilgængelighedsberegning med tests.
2. **Datamodel og adgang** – skema, constraint, RLS og databasefunktioner (via Lovable).
3. **Kundens bookingflow** – 5 trin: behandling → frisør → tidspunkt → oplysninger → gennemse, bekræftelse, sikkert ændr/aflys-link.
4. **Medarbejder- og ejerapp** – login, i dag/næste kunde, dag/uge, opret/flyt/aflys, statusser, arbejdstider, fravær, behandlinger, medarbejdere, salonindstillinger, fejlede beskeder.
5. **Beskeder** – køarbejder via Lovable Cron, mailskabeloner, WhatsApp-skabeloner og statuswebhook, påmindelser, web push + PWA.
6. **Test** – samtidige bookinger, varigheder/buffer/pauser, ferie, roller, sikre links, sommer-/vintertid, beskedfejl/genforsøg, påmindelser ved flyt/aflys, push, mobil.

## Status

Holdes ajour i `docs/status.md`: implementeret, testet og afventer ekstern opsætning skelnes tydeligt.
