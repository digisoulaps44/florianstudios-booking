import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CustomerShell } from "@/components/fs/booking";

export const Route = createFileRoute("/privatliv")({
  head: () => ({ meta: [{ title: "Privatlivspolitik – Florian Studios" }] }),
  component: Privacy,
});

// Værdier markeret med <Confirm> skal bekræftes af ejeren før lancering.
function Confirm({ children }: { children: ReactNode }) {
  return (
    <mark className="bg-transparent text-text underline decoration-dotted underline-offset-4">
      {children}
    </mark>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <h2 className="font-display text-xl text-text">{title}</h2>
      <div className="grid gap-3 text-base text-text-2">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <CustomerShell>
      <p className="text-xs font-medium tracking-[0.2em] text-text-muted uppercase">
        Opdateret 14. november 2026
      </p>
      <h1 className="mt-3 font-display text-4xl text-text">Privatlivspolitik.</h1>
      <p className="mt-4 text-base text-text-2">
        Sådan behandler Florian Studios dine oplysninger, når du booker en tid.
      </p>

      <div className="mt-10 grid gap-8">
        <Section title="Dataansvarlig">
          <p>
            Florian Studios, <Confirm>[adresse], 2730 Herlev</Confirm>, CVR{" "}
            <Confirm>[CVR-nummer]</Confirm>.
            <br />
            Kontakt: <Confirm>[mail til privatlivsspørgsmål]</Confirm> eller telefon{" "}
            <Confirm>[telefonnummer]</Confirm>.
          </p>
        </Section>

        <Section title="Hvilke oplysninger vi gemmer">
          <ul className="list-disc pl-5">
            <li>Navn, mobilnummer og mail, som du skriver, når du booker.</li>
            <li>Eventuel note til din booking.</li>
            <li>Dine bookinger: behandling, frisør, tidspunkt, pris og ændringer.</li>
            <li>Om du har valgt beskeder på WhatsApp, og hvornår.</li>
            <li>
              Medarbejdere: navn, login-mail og push-abonnementer på deres enheder (ikke kunders).
            </li>
            <li>Teknisk: IP-adresse i kort tid for at beskytte mod misbrug.</li>
          </ul>
          <p>Vi beder ikke om følsomme oplysninger. Skriv dem venligst ikke i noten.</p>
        </Section>

        <Section title="Formål og retsgrundlag">
          <ul className="list-disc pl-5">
            <li>
              At gennemføre din booking og sende bekræftelse, påmindelse og link til at flytte eller
              aflyse – nødvendigt for aftalen (GDPR art. 6, stk. 1, litra b).
            </li>
            <li>Beskeder på WhatsApp – dit samtykke (litra a). Du kan altid fravælge det.</li>
            <li>
              Bogføring, beskyttelse mod misbrug og drift af salonen – vores legitime interesse
              (litra f) og bogføringsloven (litra c).
            </li>
          </ul>
          <p>Vi bruger ikke dine oplysninger til markedsføring og sælger dem aldrig.</p>
        </Section>

        <Section title="Hvor længe vi gemmer dem">
          <p>
            Dine kontaktoplysninger slettes eller anonymiseres{" "}
            <Confirm>24 måneder efter din seneste booking</Confirm>. Bookingen selv beholdes uden
            navn og kontaktoplysninger til statistik. Oplysninger, der indgår i regnskabet, gemmes i
            5 år efter bogføringsloven. IP-adresser bruges kun i den time, de tæller mod misbrug.
          </p>
        </Section>

        <Section title="Hvem der behandler data for os">
          <ul className="list-disc pl-5">
            <li>Lovable Cloud (Supabase) – database, login og hosting, i EU.</li>
            <li>
              Mailudbyder til bekræftelser og påmindelser: <Confirm>[udbyder]</Confirm>.
            </li>
            <li>Meta (WhatsApp Business) – kun hvis du har valgt WhatsApp.</li>
          </ul>
          <p>
            Alle har databehandleraftaler med os. Hvis data overføres uden for EU, sker det efter
            EU-Kommissionens standardkontrakter eller tilsvarende grundlag.
          </p>
        </Section>

        <Section title="Dine rettigheder">
          <p>
            Du har ret til indsigt i dine oplysninger, til at få dem rettet eller slettet, til at
            begrænse eller gøre indsigelse mod behandlingen, til dataportabilitet og til at trække
            et samtykke tilbage.
          </p>
        </Section>

        <Section title="Sletning på anmodning">
          <p>
            Skriv eller ring til os, så sletter vi dine kontaktoplysninger fra alle dine bookinger,
            også fremtidige beskeder og links. Vi svarer inden for 30 dage. Fremtidige tider bør du
            aflyse først.
          </p>
        </Section>

        <Section title="Klage">
          <p>
            Du kan klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby,{" "}
            <a className="text-text underline" href="https://www.datatilsynet.dk">
              datatilsynet.dk
            </a>
            .
          </p>
        </Section>

        <p className="border-t border-line pt-6">
          <Link to="/" className="text-text underline">
            Tilbage til booking
          </Link>
        </p>
      </div>
    </CustomerShell>
  );
}
