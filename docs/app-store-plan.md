# App Store-plan – Florian Studios på iPhone (Capacitor)

Opdateret: 14. november 2026. Arbejdet ligger på branchen `app-store`. `main` synkroniseres med Lovable og røres ikke, før planen er godkendt og der laves en pull request.

## Kort fortalt

- **Én app, "Florian Studios"**, med både kundens booking og medarbejderappen. Kundens booking er forsiden, og medarbejderlogin ligger diskret i menuen.
- **Capacitor 8** pakker webappen ind i en iOS-app. WebView'et indlæser den udgivne app (`server.url`), fordi appen er SSR med serverfunktioner. En lokal offline-side ligger i selve appen.
- **Den vigtigste native værdi er push via APNs til medarbejderne.** Dertil kommer Føj til kalender, Apple Kort, opkald til salonen, haptik, universal links og Face ID-lås.
- **Appen udgives under DigiSoul Business' Apple Developer-konto** (besluttet 15/11: Florian Studios skal ikke betale ca. 800 kr. om året for egen konto). Det giver en kendt risiko for afvisning under 4.2.6/5.2.1. Tiltag og plan B står i afsnit 6.
- **Status på branchen:** Capacitor-pakker, `capacitor.config.ts`, lokal offline-side og en test er tilføjet. Xcode-projektet er genereret og bygget som test, men ikke committet (se fase 4). Der er ikke ændret noget i databasen, og intet er udgivet eller sendt til Apple.

## Beslutninger truffet nu (konservativt)

| #   | Beslutning         | Valg                                                                 | Hvorfor                                                                                                        |
| --- | ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Hvilken app        | Begge dele i én app                                                  | Én app at vedligeholde og få godkendt. Kundedelen alene er svær at forsvare under 4.2.                         |
| 2   | Udgiver            | DigiSoul Business (besluttet 15/11)                                  | Pris. Risiko under 4.2.6/5.2.1 afbødes med skriftlig tilladelse og review-noter; plan B i afsnit 6.            |
| 3   | Bundle ID          | `dk.florianstudio.app`                                               | Omvendt domæne for florianstudio.dk. **Kan ikke ændres**, når appen er oprettet i App Store Connect.           |
| 4   | Indlæsning         | `server.url` (udgivet app) + lokal offline-side                      | Appen kan ikke bundtes statisk uden en stor ombygning (afsnit 3). Plan B er beskrevet.                         |
| 5   | Domæne             | `book.florianstudio.dk` (besluttet 15/11), sat op før review         | Universal links og AASA-fil kræver et domæne, vi ejer. `blank-canvas-preview.lovable.app` bruges kun til test. |
| 6   | Push-vej           | APNs direkte fra serveren, ellers via en Lovable Cloud edge function | Ingen ny databehandler. Firebase (Google) kun som sidste udvej (afsnit 2).                                     |
| 7   | Capacitor-version  | Præcis `8.6.0` (ikke `^`)                                            | Udgivet 28/10 2026, over to uger gammel. 8.6.1/8.6.2 er to dage gamle, og 9.0 er kun release candidate.        |
| 8   | Enheder            | Kun iPhone (`TARGETED_DEVICE_FAMILY = 1`)                            | Undgår krav om iPad-skærmbilleder og iPad-layout. Indstilles i fase 4.                                         |
| 9   | Sign in with Apple | Tilføjes ikke                                                        | Ikke krævet, da der kun er login med mail og adgangskode (afsnit 5).                                           |
| 10  | Kontosletning      | "Slet min konto" i Indstillinger                                     | Konti oprettes kun ved invitation, så det er næppe krævet. Det er den sikre løsning (afsnit 5).                |

## Beslutninger, I skal træffe

1. **Apple-konto: DigiSoul Business (besluttet).** Appen oprettes, bygges og indsendes fra DigiSouls team. Sælgernavnet i App Store bliver DigiSouls juridiske navn. Florian Studios betaler ikke for en konto.
2. **Skriftlig tilladelse fra Florian Studios – modtaget 15/11.** Florian Studios har givet DigiSoul skriftlig tilladelse til at udgive appen med Florian Studios' navn, logo og indhold (5.2.1). Erklæringen opbevares hos DigiSoul (ikke i repoet), nævnes i App Review-noterne og kan sendes til Apple på forespørgsel.
3. **Domæne.** `book.florianstudio.dk` er valgt. Det sættes op som eget domæne i Lovable med de DNS-poster, Lovable viser. Når det virker med https, sættes secret'en `PUBLIC_APP_URL=https://book.florianstudio.dk` (links i mails, push og invitationer), og appen udgives igen. Først derefter bygges appen til TestFlight/App Store – adressen er bygget ind i appen, og et senere domæneskift kræver en ny app-version og et nyt review.
4. **Navn i App Store.** Forslag: "Florian Studios" (højst 30 tegn) med undertitlen "Book tid i Herlev". Navnet skal være ledigt i App Store.
5. **Privatlivspolitik.** Branchen `feat/privacy-gdpr` skal merges og udgives, og de markerede værdier skal bekræftes. Afsnittet om appen i afsnit 5 skal også tilføjes.
6. **App Review.** Godkend en demokonto til Apples reviewer (afsnit 5). Godkend også, at reviewer kan komme til at lave en rigtig booking i reviewperioden. Florian får besked og aflyser den.
7. **Support-URL.** Apple kræver en side med kontaktoplysninger, fx `florianstudio.dk` eller en kontaktside dér.

---

## 1. Guideline 4.2 – minimumsfunktionalitet og native værdi

Guideline 4.2 kræver, at en app er mere end "a repackaged website". Den skal være nyttig, unik eller "app-agtig". 4.2.2 nævner desuden "web clippings" som noget, apps ikke primært må være. En booking-side, der fungerer fint i Safari, er præcis den type app, Apple afviser, hvis den ikke giver noget ekstra.

**Strategi:** Medarbejderappen bærer appen, fordi push, notifikationscenter og kalender er reel nytte. Kundedelen får native detaljer, der gør den bedre end i Safari. Webagtige elementer skjules i appen.

| Funktion                                 | Hvem         | Hvordan                                                                                                                                                                                                     | Prioritet |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Push ved ny, flyttet og aflyst booking   | Medarbejdere | `@capacitor/push-notifications` + APNs (afsnit 2)                                                                                                                                                           | Skal      |
| Tryk på push åbner bookingen             | Medarbejdere | `pushNotificationActionPerformed` → router til `/app/booking/<id>`                                                                                                                                          | Skal      |
| Føj til kalender                         | Kunde        | EventKit med Apples eget redigeringsark, fx `@ebarooni/capacitor-calendar` (`createEventWithPrompt`). Det nuværende `text/calendar`-trick virker i Safari, men sandsynligvis ikke i WKWebView. Verificeres. | Skal      |
| Vis vej (Apple Kort) og Ring til salonen | Kunde        | Intet plugin. Capacitor åbner `maps.apple.com` og `tel:` uden for appen. Verificeres på iPhone.                                                                                                             | Skal      |
| Haptik                                   | Begge        | `@capacitor/haptics` ved bekræftet booking, fejl og statusskift. `navigator.vibrate` virker ikke på iPhone.                                                                                                 | Skal      |
| Statusbjælke, splash og tastatur         | Begge        | `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`                                                                                                                                  | Skal      |
| Universal links                          | Begge        | Kundens link fra mail og WhatsApp (`/booking/<token>`) og medarbejderlinks åbner appen. Kræver Associated Domains, AASA-fil på eget domæne og `@capacitor/app` (`appUrlOpen`).                              | Bør       |
| Face ID-lås                              | Medarbejdere | Lås medarbejderdelen efter fx 15 min i baggrunden, fx med `@aparajita/capacitor-biometric-auth`. Kan kombineres med at gemme login i nøgleringen (afsnit 3).                                                | Bør       |
| Push-påmindelse til kunden               | Kunde        | Token knyttet til bookingen uden login. Senere, hvis 4.2 driller.                                                                                                                                           | Kan       |

**Skjules i appen** (når `Capacitor.isNativePlatform()`): vejledningen "Føj til hjemmeskærm", web push-teksten om iOS 16.4, PWA-installation og links, der ville åbne hjemmesiden i appen. Eksterne links åbnes i Safari.

**Pluginversioner:** Plugins har både en native del i app-binæren og en JS-del i webappen fra Lovable. Opdateres JS-delen uden en ny app-version, kan kald fejle. Pin pluginversioner præcist, tjek `Capacitor.isPluginAvailable()` før brug, og udgiv en ny app-version, når et plugin opgraderes.

## 2. Push: Web Push virker ikke i appen – APNs i stedet

**Hvorfor:** Push API'et findes ikke i WKWebView. Apple har bekræftet, at Web Push ikke virker i apps med WKWebView. Det virker kun i Safari og i webapps på hjemmeskærmen. Det betyder:

- `src/server/messages/webpush.ts` og `public/sw.js` fortsætter uændret for PWA'en, men når ikke iPhone-appen.
- `src/lib/push.ts` vil i appen vise "føj til hjemmeskærmen", fordi `isIos() && !isStandalone()` er sand i WKWebView. Funktionen skal have en native gren.
- Service workeren skal ikke registreres i appen (`src/routes/app.tsx`). Den gør ingen nytte dér.

**Flow i appen:**

```
Medarbejder logger ind → trykker "Slå notifikationer til"
  → PushNotifications.requestPermissions() → register()
  → 'registration' giver APNs-token → gemmes i native_push_tokens (egen række, RLS)
Kunde booker → create_booking lægger et push-job i message_jobs (uændret)
  → cron-arbejderen → sendPushToStaff → web push-abonnementer + APNs-tokens
  → APNs → iPhone viser notifikationen → tryk åbner /app/booking/<id>
```

**Database (via Lovable, ikke i hånden):** ny tabel frem for at ændre `push_subscriptions`, hvor `p256dh` og `auth` er `NOT NULL`. Forslag til Lovable:

```sql
create table public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                 -- ingen FK til auth.users (Lovable afviser det)
  platform text not null default 'ios' check (platform in ('ios')),
  token text not null unique,            -- APNs-device token (hex)
  environment text not null check (environment in ('sandbox', 'production')),
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  expired_at timestamptz
);
alter table public.native_push_tokens enable row level security;
create policy "own native push tokens" on public.native_push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on table public.native_push_tokens from anon;
grant select, insert, update, delete on table public.native_push_tokens to authenticated;
grant all on table public.native_push_tokens to service_role;
```

**Beskedkøen (`message_jobs`, kanalen `push`):**

- **Ingen ændring i enum, skabeloner eller databasefunktioner.** `create_booking` m.fl. opretter allerede ét `push`-job pr. medarbejder, når `staff.notify_push` er slået til. Det sker uafhængigt af abonnementer.
- `sendPushToStaff` i `channels.server.ts` sender til både web push-abonnementer og APNs-tokens. Jobbet er `sent`, hvis mindst én enhed modtog beskeden.
- "Ingen aktive pushabonnementer" (job `cancelled`) gælder kun, hvis der hverken er web- eller APNs-modtagere.
- Ny fil `src/server/messages/apns.ts` med samme WebCrypto-tilgang som VAPID: ES256-JWT (`kid` = Key ID, `iss` = Team ID). Tokenet genbruges i op til 50 min, da Apple afviser for hyppige nye tokens. Kaldet er `POST /3/device/<token>` til `api.push.apple.com`, eller `api.sandbox.push.apple.com` for sandbox-tokens. Headers: `apns-topic: dk.florianstudio.app`, `apns-push-type: alert`, `apns-priority: 10`, `apns-expiration` (+24 t, som web push' TTL) og `apns-collapse-id` (booking-id). Payload: `{"aps":{"alert":{"title","body"},"sound":"default","thread-id":"bookinger"},"url":"/app/booking/<id>"}`. Indholdet kommer fra `pushContent()` i `templates.ts`, som i dag.
- **Fejl fra APNs:**

| Svar                                                                 | Handling                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 200                                                                  | Leveret. `last_success_at` opdateres, og `apns-id` gemmes som `provider_message_id`.                       |
| 410 `Unregistered`, 400 `BadDeviceToken`/`DeviceTokenNotForTopic`    | Tokenet markeres `expired_at` og springes over (som 404/410 for web push).                                 |
| 403 `InvalidProviderToken`/`ExpiredProviderToken`, manglende secrets | Opsætningsfejl. Leveres intet andet, kastes `ChannelNotConfigured`, så jobbet venter uden at bruge forsøg. |
| 429, 5xx, netværksfejl                                               | Midlertidig fejl. Almindelig backoff, som i dag.                                                           |

- **Secrets (Lovable → Secrets):** `APNS_KEY_ID`, `APNS_TEAM_ID` og `APNS_PRIVATE_KEY` (indholdet af `.p8`-filen). Nøglen oprettes i DigiSouls team. Mangler de, kører web push videre, og APNs-delen venter.
- **Sandbox og produktion:** Builds fra Xcode bruger sandbox. TestFlight og App Store bruger produktion. Appen sender miljøet med, når tokenet gemmes, og serveren vælger host derefter.
- **Logud og deaktivering:** Ved logud slettes enhedens token. Når ejeren deaktiverer en medarbejder, slettes vedkommendes tokens.
- **Tests:** JWT-signatur (verificeres med den offentlige nøgle), payload, fejlmapping og blandet levering (web og APNs) i samme job.

**Risiko: HTTP/2 fra Cloudflare Workers.** APNs kræver HTTP/2. Cloudflare dokumenterer ikke, om `fetch()` fra en Worker bruger HTTP/2 mod eksterne servere. En ældre changelog nævner HTTP/1.1, og en udvikler melder, at APNs virkede i praksis. Derfor:

1. **Spike først** (fase 3): send én push til et sandbox-token fra den udgivne Worker. Lykkes det, bruges direkte APNs.
2. **Fallback:** en Lovable Cloud edge function (Deno, understøtter HTTP/2), fx `send-apns`. Arbejderen kalder den med en delt hemmelighed. Den oprettes via Lovable.
3. **Sidste udvej:** Firebase Cloud Messaging (HTTP/1.1). Det kræver en Firebase-konto og gør Google til ny databehandler, så privatlivspolitikken skal opdateres.

## 3. Bundling: SSR og serverfunktioner

**Udgangspunkt:** Appen er TanStack Start med SSR på Cloudflare via Lovable. Serverfunktioner kaldes som RPC til `/_serverFn/...` på samme domæne. `createCsrfMiddleware` i `src/start.ts` afviser kald fra andre origins, og login sendes som bearer-token (`auth-attacher.ts`). En statisk `webDir`-build alene kan derfor ikke tale med serveren.

| Mulighed                                  | Hvordan                                                                                                                                                                           | Fordele                                                                                                                             | Ulemper                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. `server.url` → udgivet app** (valgt) | WebView'et indlæser `https://<domæne>`. `webDir` har kun startside og offline-side.                                                                                               | Ingen ombygning. Samme kode som web, og Lovable-udgivelser når appen med det samme. Serverfunktioner, CSRF og login virker uændret. | Capacitor skriver, at `server.url` ikke er beregnet til produktion. Uden net vises kun offline-siden. Størst risiko under 4.2.                         |
| B. Statisk klient i `webDir`              | TanStack Start i SPA-tilstand. Serverfunktioner sendes til produktionsdomænet via egen `fetch` eller `CapacitorHttp`, med CORS og en CSRF-undtagelse for `capacitor://localhost`. | Appen åbner uden net, og UI'et ligger i binæren. Lavere risiko under 4.2.                                                           | Stor ombygning, som Lovable ikke bygger. Kræver en separat build-pipeline. UI-rettelser kræver en ny app-version. Risiko for at skille sig fra `main`. |
| C. Lokal skal, der navigerer ud           | Lokal `index.html` sender videre til domænet via `allowNavigation`.                                                                                                               | Som A.                                                                                                                              | Som A. `allowNavigation` er også markeret "ikke til produktion". Ingen reel gevinst.                                                                   |

**Valg: A**, med disse afbødninger:

- **Offline:** `server.errorPath` viser `capacitor/www/offline.html` med "Prøv igen" og "Ring til salonen". Den prøver selv igen, når nettet kommer tilbage. _(Lavet.)_
- **4.2:** de native funktioner i afsnit 1 skal kunne ses inden for det første minut af review. Webagtige elementer skjules. Reviewer får en demokonto og noter, der peger på push, kalender og Face ID.
- **2.5.2:** Indhold og rettelser i den udgivne webapp når appen uden review. Det er almindelig praksis for WebView-apps, men 2.5.2 forbyder at hente kode, der ændrer appens funktioner. Konservativ praksis: **nye funktioner i appen udgives som en ny app-version til review**, ikke kun via Lovable.
- **Domæne:** kun appens eget domæne vises i appen. Alt andet åbnes uden for appen (Capacitors standard uden `allowNavigation`).
- **Login-session:** Supabase gemmer sessionen i WebView'ets `localStorage`. Det skal verificeres i TestFlight, at medarbejdere ikke logges ud efter 7 dage uden brug (WebKits lagringsgrænser). Ellers gemmes refresh-tokenet i nøgleringen bag Face ID.

**Plan B** (mulighed B) aktiveres, hvis Apple afviser under 4.2 trods de native funktioner. Det skønnes at være flere dages arbejde og kræver en beslutning om separat build-pipeline uden om Lovable.

## 4. Ikoner, splash og skærmbilleder

- **App-ikon:** 1024 × 1024 px PNG uden gennemsigtighed og uden afrundede hjørner (iOS runder selv). Laves fra brandet: bone på ink, Playfair. De eksisterende `public/icons` (192/512) er for små. Xcode 26+ kan bruge ét ikon i fuld størrelse. Et lagdelt Liquid Glass-ikon fra Icon Composer er valgfrit.
- **Splash:** ink-baggrund (#010101) med logo, statisk og uden tekst. Genereres med `@capacitor/assets` fra `assets/icon-only.png`, `assets/splash.png` og `assets/splash-dark.png`. Splash skjules, når webappen har tegnet første skærm (`launchAutoHide: false` + `SplashScreen.hide()` fra webappen). Ellers ses et hvidt blink, mens den udgivne app hentes.
- **Statusbjælke:** lys tekst (`Style.Dark` i `@capacitor/status-bar`), da hele appen er mørk.
- **Skærmbilleder:** iPhone 6,9" (1320 × 2868 px stående) er påkrævet. App Store Connect skalerer ned til mindre skærme. Ingen iPad-skærmbilleder, da appen kun er til iPhone. Forslag til 5 billeder: behandling, frisørvalg, ledige tider, kvittering med "Føj til kalender" og medarbejderens "I dag" med en push.

## 5. Privatliv, login og review

- **Privatlivspolitik (påkrævet URL):** `/privatliv` fra `feat/privacy-gdpr` merges og udgives. Tilføj et afsnit om appen: push-tokens (formål, sletning ved logud), at Face ID aldrig forlader telefonen (appen får kun ja/nej), og Apple (APNs) som modtager af push-indhold.
- **App Privacy i App Store Connect:** Kontaktoplysninger (navn, mobil, mail) og evt. noter til appens funktion, knyttet til brugeren, ingen sporing. Bruger-ID og push-token for medarbejdere. Ingen sporing, så App Tracking Transparency er ikke nødvendig.
- **Privacy manifest:** `PrivacyInfo.xcprivacy` i app-targetet (`NSPrivacyTracking = false` + indsamlede datatyper). Capacitor og de officielle plugins har deres egne.
- **Eksportkontrol:** `ITSAppUsesNonExemptEncryption = NO` i `Info.plist`. Appen bruger kun HTTPS og systemets kryptering.
- **Sign in with Apple – ikke krævet:** Guideline 4.8 kræver kun et ligeværdigt login-alternativ, når appen bruger tredjeparts- eller sociale logins (Google, Facebook o.l.). Appen bruger kun sit eget login med mail og adgangskode og er undtaget. Kunder logger slet ikke ind. **Tilføjes der senere Google-login, skal der også være et alternativ, fx Sign in with Apple.**
- **Kontosletning (5.1.1(v)):** Kravet gælder apps, der understøtter oprettelse af konti. Her opretter ejeren konti ved invitation, og tilmelding slås fra. Konservativt tilføjes "Slet min konto" i Indstillinger. Den deaktiverer medarbejderprofilen (bookinger bevares), sletter push-tokens og sletter login-kontoen via en serverfunktion. Ejeren kan ikke slette sig selv uden først at overdrage ejerskabet. Eventuelle databaseændringer laves via Lovable.
- **Demokonto til App Review:** medarbejderen "App Review" uden behandlinger og arbejdstider, så profilen ikke vises for kunder. Det skal verificeres. Ejeren lægger testbookinger i profilens kalender, og konto og data fjernes efter godkendelse. Loginoplysningerne skrives kun i App Store Connect, aldrig i repoet.
- **Review-noter (forslag):** Kundedelen laver rigtige bookinger i en rigtig salon, så reviewer bedes aflyse via linket i kvitteringen. Medarbejderdelen åbnes via menuen → Medarbejderlogin. Push, Føj til kalender og Face ID beskrives med en kort skærmoptagelse.
- **Aldersgrænse:** 4+. Kategori: Livsstil.

## 6. Konto og ejerskab

**Besluttet 15/11: appen udgives under DigiSoul Business' konto** af hensyn til prisen for Florian Studios. Apples regler peger mod, at virksomheden selv udgiver, så valget har en reel risiko for afvisning:

- **4.2.6:** Apps lavet fra skabeloner eller med en app-generator afvises, medmindre de indsendes direkte af den, der leverer appens indhold. Sådanne tjenester må ikke indsende apps for deres kunder. Appen er bygget med Lovable (en app-generator) af et bureau for en kunde, hvilket er netop det tilfælde.
- **5.2.1:** Apps skal indsendes af den person eller juridiske enhed, der ejer eller har licens til det immaterielle indhold. Navn, logo og indhold tilhører Florian Studios.
- **5.1.1(ix)** (kræver juridisk enhed i stærkt regulerede brancher som bank og sundhed) gælder ikke en frisør.
- I praksis afviser Apple ofte apps for en navngiven virksomhed, når sælgeren er en anden. En app kan flyttes mellem konti senere, men Bundle ID, APNs-nøgle og TestFlight-historik er knyttet til teamet. Det taler for at starte i Florians team – men af hensyn til prisen starter appen i DigiSouls team (se ovenfor).

**Sådan mindskes risikoen:**

- `dk.florianstudio.app` registreres i DigiSouls team med Push Notifications og Associated Domains; APNs-nøglen oprettes dér.
- Skriftlig tilladelse fra Florian Studios til navn, logo og indhold (5.2.1) – nævnes i App Review-noterne og kan sendes til Apple på forespørgsel.
- Review-noterne forklarer, at appen er udviklet specifikt til Florian Studios på opdrag og med tilladelse, og at DigiSoul drifter den for salonen.
- Appen må ikke ligne en skabelon: eget navn, egne farver/fonte, eget indhold – og DigiSoul indsender ikke næsten ens apps for andre saloner fra samme kode (det er netop det, 4.2.6 rammer).

**Plan B ved afvisning under 4.2.6/5.2.1:** Florian Studios opretter en egen konto, og appen flyttes dertil med App Transfer (muligt, når appen er udgivet mindst én gang og begge konti er i orden) eller oprettes på ny med et nyt Bundle ID, hvis den ikke er udgivet endnu.

## 7. Faser

| Fase                     | Indhold                                                                                                                                                                                                                                                                                                                                                          | Hvem               | Status                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- |
| 0. Fundament             | `@capacitor/core`, `@capacitor/ios` og `@capacitor/cli` (8.6.0, bun.lock), `capacitor.config.ts`, `capacitor/www` (startside, offline-side, fonte), `cap:sync`/`cap:open`-scripts, test i `src/test/capacitor-config.test.ts`. `npx cap add ios` og simulator-build er afprøvet.                                                                                 | Claude             | **Færdig på `app-store`** |
| 1. Konto og domæne       | Apple-tilmelding, team-invitation, D-U-N-S ved ApS, eget domæne i Lovable, privatlivspolitik merget.                                                                                                                                                                                                                                                             | Ejer + udvikler    | Afventer                  |
| 2. Native lag i webappen | `src/lib/native.ts` (`isNativeApp()`, haptik, statusbjælke, splash, tastatur, eksterne links). Native gren i `push.ts`, ingen service worker i appen, kalender-plugin, skjul PWA-vejledning, diskret medarbejderlogin i menuen. Alt bag `Capacitor.isNativePlatform()`, så web er uændret.                                                                       | Claude             | Ikke startet              |
| 3. APNs på serveren      | HTTP/2-spike, `apns.ts`, udvidet `sendPushToStaff`, tests. Tabellen `native_push_tokens` og APNs-secrets via Lovable.                                                                                                                                                                                                                                            | Claude + Lovable   | Ikke startet              |
| 4. Xcode-projekt         | Commit `ios/` (genereres med `npx cap add ios`). Capabilities: Push Notifications, Associated Domains (`applinks:<domæne>`), Background Modes → Remote notifications er ikke nødvendig. `Info.plist`: kalender- og Face ID-tekster på dansk, `ITSAppUsesNonExemptEncryption`. `PrivacyInfo.xcprivacy`, kun iPhone, ikoner og splash, signering i DigiSouls team. | Claude + udvikler  | Ikke startet              |
| 5. TestFlight            | Intern test på rigtige iPhones (tjekliste nedenfor).                                                                                                                                                                                                                                                                                                             | Udvikler + Florian | Ikke startet              |
| 6. Indsendelse           | Metadata, skærmbilleder, App Privacy, review-noter og demokonto. Indsendes af udvikler eller Florian, ikke af Claude.                                                                                                                                                                                                                                            | Udvikler + Florian | Ikke startet              |

**Fra `app-store` til `main`:** Når fase 2 og 3 er klar, laves en pull request mod `main`. Lovable bygger og udgiver webdelen som normalt. Mappen `capacitor/` og `capacitor.config.ts` påvirker ikke Lovables build. `ios/` kan ligge på `main` eller blive på `app-store`. Det besluttes ved fase 4.

## 8. Tjekliste før review (TestFlight på rigtig iPhone)

- [ ] Appen åbner direkte i bookingen uden hvidt blink. Splash og statusbjælke passer til ink.
- [ ] Indhold ligger korrekt under Dynamic Island og over hjemmeindikatoren. Ingen vandret scroll.
- [ ] Tastaturet dækker ikke felter, og bundbjælker glider væk.
- [ ] Flytilstand viser offline-siden. "Prøv igen" og automatisk genforsøg virker.
- [ ] Føj til kalender åbner iOS' kalenderark. Vis vej åbner Kort. Ring åbner telefonen.
- [ ] Push i produktion (TestFlight): ny, flyttet og aflyst booking giver notifikation, og tryk åbner bookingen. Med appen åben vises banneret også.
- [ ] Logud fjerner tokenet, og der kommer ingen push bagefter.
- [ ] Universal link fra mail og WhatsApp åbner appen på den rigtige booking.
- [ ] Face ID-lås efter baggrund. Login er bevaret efter 8 dage uden brug.
- [ ] Ingen "Føj til hjemmeskærm"- eller web push-vejledning i appen. Eksterne links åbner i Safari.
- [ ] VoiceOver, større tekst (Dynamic Type) og reduceret bevægelse.

## 9. Risici

| Risiko                                                     | Sandsynlighed         | Afbødning                                                                         |
| ---------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| Afvisning under 4.2 (for meget hjemmeside)                 | Mellem                | Native funktioner synlige for reviewer, demokonto, video. Plan B: statisk klient. |
| Afvisning under 4.2.6/5.2.1 (forkert udgiver)              | Mellem–høj (DigiSoul) | Skriftlig tilladelse, review-noter, ingen skabelonpræg. Plan B: Florians konto.   |
| APNs virker ikke fra Workers (HTTP/2)                      | Ukendt                | Spike først, derefter edge function, sidst FCM.                                   |
| `server.url` er ikke officielt til produktion              | Lav–mellem            | Pinnet Capacitor-version, test ved hver opgradering, offline-side.                |
| JS- og native-pluginversioner kommer ud af trit            | Mellem                | Præcise versioner, `isPluginAvailable()`, ny app-version ved pluginopgradering.   |
| Reviewer laver rigtige bookinger                           | Høj                   | Review-noter, Florian varslet, aflysning via link.                                |
| Krav om Xcode 26 / iOS 26 SDK til upload (siden 28/4 2026) | –                     | Xcode 27 er installeret. Capacitor 8 kræver Xcode 26+.                            |

## Kilder

- Apple, App Store Review Guidelines (4.2, 4.2.2, 4.2.6, 4.8, 5.1.1, 5.2.1, 2.5.2): https://developer.apple.com/app-store/review/guidelines/
- Apple, tilmelding til Apple Developer Program (organisation, D-U-N-S, enkeltmandsvirksomheder): https://developer.apple.com/programs/enroll/
- Apple, SDK-krav (Xcode 26 fra 28/4 2026): https://developer.apple.com/news/upcoming-requirements/
- Apple, forbindelse til APNs (HTTP/2, TLS 1.2): https://developer.apple.com/documentation/usernotifications/establishing-a-connection-to-apns
- Apple Developer Forums, Web Push virker ikke i WKWebView: https://developer.apple.com/forums/thread/760767
- Capacitor, konfiguration (`server.url`, `errorPath`, `allowNavigation`): https://capacitorjs.com/docs/config
- Capacitor, iOS (iOS 15+, Xcode 26+): https://capacitorjs.com/docs/ios
- Cloudflare Workers, protokoller og changelog (HTTP-version for subrequests): https://developers.cloudflare.com/workers/reference/protocols/ og https://developers.cloudflare.com/workers/platform/changelog/historical-changelog/
- Cloudflare Community, APNs fra Workers: https://community.cloudflare.com/t/workers-fetch-and-http-2/389945
