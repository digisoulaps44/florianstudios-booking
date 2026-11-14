import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Button, Notice, Spinner, TextField } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { formatDateShort } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { formatPhone } from "@/lib/phone";
import { useMe } from "@/lib/staff-data";

export const Route = createFileRoute("/app/kunder")({ component: Customers });

type Customer = {
  customer_phone: string;
  customer_email: string | null;
  customer_name: string;
  booking_count: number;
  last_booking_at: string;
};

function Customers() {
  const me = useMe();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  if (!me.isOwner) return <Notice tone="error" title="Kun ejeren har adgang til kundedata." />;

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setMsg({ tone: "error", text: "Skriv mindst 3 tegn af telefonnummer eller mail." });
      return;
    }
    setLoading(true);
    setMsg(undefined);
    const { data, error } = await supabase.rpc("search_customers", { p_query: q });
    setLoading(false);
    if (error) {
      setMsg({ tone: "error", text: "Søgningen mislykkedes. Prøv igen." });
      return;
    }
    setResults((data ?? []) as Customer[]);
  };

  const anonymize = async (c: Customer) => {
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "anonymize_customer",
      c.customer_email
        ? { p_phone: c.customer_phone, p_email: c.customer_email }
        : { p_phone: c.customer_phone },
    );
    setBusy(false);
    setConfirming(undefined);
    if (error) {
      setMsg({ tone: "error", text: "Kunden kunne ikke anonymiseres. Intet er ændret." });
      return;
    }
    setResults((r) => r?.filter((x) => x.customer_phone !== c.customer_phone));
    const kept = bookingsLabel(Number(data ?? 0));
    const text = `${c.customer_name} er anonymiseret. ${kept} beholdes uden navn, telefon, mail og note.`;
    setMsg({ tone: "success", text });
    notifySuccess("Kunden er anonymiseret", { description: `${kept} beholdes til statistik.` });
  };

  return (
    <>
      <PageHeader eyebrow="Ejer" title="Kunder." />
      <div className="grid max-w-text gap-6">
        <p className="text-sm text-text-2">
          Når en kunde beder om sletning: find kunden og anonymisér. Navn, telefon, mail og note
          fjernes fra alle bookinger, links og ventende beskeder. Bookingerne beholdes til
          statistik.
        </p>
        <form onSubmit={search} className="grid gap-3" noValidate>
          <TextField
            label="Telefon eller mail"
            type="search"
            inputMode="search"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" className="justify-self-start" disabled={loading}>
            Søg
          </Button>
        </form>
        {msg ? <Notice tone={msg.tone} title={msg.text} live reveal /> : null}
        {loading ? <Spinner /> : null}
        {results && !loading ? (
          results.length === 0 ? (
            msg?.tone === "success" ? null : (
              <p className="text-sm text-text-2">Ingen kunder fundet.</p>
            )
          ) : (
            <ul className="border-y border-line">
              {results.map((c, idx) => (
                <li
                  key={c.customer_phone}
                  className={`grid gap-3 px-3 py-4 ${idx > 0 ? "border-t border-line" : ""}`}
                >
                  <div>
                    <p className="font-medium text-text">{c.customer_name}</p>
                    <p className="text-sm text-text-2">
                      {formatPhone(c.customer_phone)}
                      {c.customer_email ? ` · ${c.customer_email}` : ""}
                    </p>
                    <p className="text-sm text-text-muted">
                      {bookingsLabel(c.booking_count)} · seneste{" "}
                      {formatDateShort(new Date(c.last_booking_at))}
                    </p>
                  </div>
                  {confirming === c.customer_phone ? (
                    <div role="group" aria-label="Bekræft anonymisering" className="grid gap-3">
                      <p className="text-sm text-text">
                        Dette kan ikke fortrydes. Fremtidige tider bør aflyses først – kunden får
                        ingen beskeder efter anonymisering.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={busy} onClick={() => anonymize(c)}>
                          Ja, anonymisér
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirming(undefined)}>
                          Annullér
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="justify-self-start"
                      onClick={() => setConfirming(c.customer_phone)}
                    >
                      Anonymisér
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </>
  );
}

function bookingsLabel(n: number) {
  return `${n} ${n === 1 ? "booking" : "bookinger"}`;
}
