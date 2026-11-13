import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/staff-data";

export const Route = createFileRoute("/app/mere")({ component: More });

function More() {
  const me = useMe();
  const navigate = useNavigate();
  const own = [
    {
      to: "/app/tider",
      label: "Arbejdstider og fravær",
      hint: "Ugentlige tider, pauser, ferie og blokeringer",
    },
    { to: "/app/behandlinger", label: "Behandlinger", hint: "Priser, varigheder og buffer" },
    {
      to: "/app/indstillinger",
      label: "Notifikationer og profil",
      hint: "Mail, push og kontaktoplysninger",
    },
  ];
  const owner = [
    { to: "/app/medarbejdere", label: "Medarbejdere", hint: "Invitér, deaktivér og administrér" },
    {
      to: "/app/salon",
      label: "Salonindstillinger",
      hint: "Afbestillingsfrist, påmindelser og bookingvindue",
    },
    {
      to: "/app/beskeder",
      label: "Fejlede beskeder",
      hint: "Mail, WhatsApp og push der ikke kom frem",
    },
  ];
  return (
    <>
      <PageHeader eyebrow={me.displayName ?? "Konto"} title="Mere." />
      <nav aria-label="Mere" className="grid max-w-text gap-10">
        <List items={own} />
        {me.isOwner ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
              Ejer
            </p>
            <List items={owner} />
          </div>
        ) : null}
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={async () => {
            await supabase.auth.signOut();
            await navigate({ to: "/login" });
          }}
        >
          Log ud
        </Button>
      </nav>
    </>
  );
}

function List({ items }: { items: Array<{ to: string; label: string; hint: string }> }) {
  return (
    <ul className="border-y border-line">
      {items.map((i, idx) => (
        <li key={i.to} className={idx > 0 ? "border-t border-line" : undefined}>
          <Link
            to={i.to}
            className="flex min-h-16 items-center justify-between gap-4 px-3 py-3 hover:bg-bone/10"
          >
            <span>
              <span className="block text-base font-medium text-text">{i.label}</span>
              <span className="block text-sm text-text-2">{i.hint}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 text-text-2" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
