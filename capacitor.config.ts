import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Florian Studios som iOS-app (Capacitor 8). Baggrund og beslutninger: docs/app-store-plan.md.
 *
 * Appen er SSR med serverfunktioner (TanStack Start på Cloudflare via Lovable) og kan ikke pakkes
 * som statiske filer uden en større ombygning. WebView'et indlæser derfor den udgivne app
 * (`server.url`), og `webDir` indeholder kun en lille lokal skal: en startside, som CLI'en kræver,
 * og offline-siden, der vises, hvis den udgivne app ikke kan nås.
 *
 * - `appId` kan ikke ændres, når appen først er oprettet i App Store Connect.
 * - Skift til eget domæne (fx booking.florianstudio.dk), før appen sendes til review. Husk at rette
 *   START_URL i capacitor/www/offline.html samtidig – testen i src/test/capacitor-config.test.ts
 *   fanger det, hvis de to ikke matcher.
 * - CAP_SERVER_URL kan pege på en lokal udviklingsserver under test (fx http://192.168.1.20:8080).
 *   Den må aldrig sættes i en build, der sendes til TestFlight eller App Store.
 */
export const PRODUCTION_URL = "https://blank-canvas-preview.lovable.app";

const serverUrl = process.env["CAP_SERVER_URL"] ?? PRODUCTION_URL;

const config: CapacitorConfig = {
  appId: "dk.florianstudio.app",
  appName: "Florian Studios",
  webDir: "capacitor/www",
  backgroundColor: "#010101",
  server: {
    url: serverUrl,
    // Vises fra webDir, hvis den udgivne app ikke kan indlæses (fx uden net).
    errorPath: "offline.html",
    // Ingen allowNavigation: kun appens egen host vises i appen. Kort, telefon og andre links
    // åbnes uden for appen (Capacitors standard).
  },
  ios: {
    // Siden styrer selv safe areas med env(safe-area-inset-*) og viewport-fit=cover.
    contentInset: "never",
    backgroundColor: "#010101",
    preferredContentMode: "mobile",
  },
};

export default config;
