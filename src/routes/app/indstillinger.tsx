import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Share } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, CheckboxRow, Notice, Spinner, TextField } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { useMe, useStaffList } from "@/lib/staff-data";
import { fetchPushConfig } from "@/lib/messages.functions";

export const Route = createFileRoute("/app/indstillinger")({ component: Settings });

function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const staff = useStaffList();
  const mine = staff.data?.find((s) => s.id === me.staffId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  useEffect(() => {
    if (mine) {
      setName(mine.display_name);
      setPhone(mine.phone ?? "");
    }
  }, [mine]);

  const patch = async (
    values: Partial<{
      display_name: string;
      phone: string | null;
      notify_email: boolean;
      notify_push: boolean;
      notify_all_bookings: boolean;
    }>,
    text: string,
  ) => {
    if (!mine) return;
    const { error } = await supabase.from("staff").update(values).eq("id", mine.id);
    setMsg(
      error
        ? { tone: "error", text: `Kunne ikke gemmes: ${error.message}` }
        : { tone: "success", text },
    );
    await qc.invalidateQueries({ queryKey: ["staff"] });
  };

  if (staff.isPending) return <Spinner />;

  return (
    <>
      <PageHeader eyebrow="Indstillinger" title="Notifikationer og profil." />
      <div className="grid max-w-text gap-12">
        {msg ? <Notice tone={msg.tone} title={msg.text} live /> : null}
        {!mine ? (
          <Notice title="Du har ingen medarbejderprofil.">
            Notifikationer kræver en profil. Opret dig selv under Medarbejdere.
          </Notice>
        ) : (
          <>
            <section aria-labelledby="notif" className="grid gap-4">
              <h2 id="notif" className="text-2xl leading-8 text-text">
                Notifikationer
              </h2>
              <p className="text-sm text-text-2">
                Du får besked, når en kunde booker, flytter eller aflyser hos dig.
                Notifikationscenteret virker altid – også uden push.
              </p>
              <div className="border-y border-line">
                <CheckboxRow
                  checked={mine.notify_email}
                  onChange={(v) =>
                    patch({ notify_email: v }, v ? "Mail slået til." : "Mail slået fra.")
                  }
                  title="Mail"
                  description={`Til ${mine.email}`}
                />
                <div className="border-t border-line">
                  <CheckboxRow
                    checked={mine.notify_push}
                    onChange={(v) =>
                      patch({ notify_push: v }, v ? "Push slået til." : "Push slået fra.")
                    }
                    title="Push på denne og andre enheder"
                    description="Kræver at push også er slået til på enheden nedenfor."
                  />
                </div>
                {me.isOwner ? (
                  <div className="border-t border-line">
                    <CheckboxRow
                      checked={mine.notify_all_bookings}
                      onChange={(v) =>
                        patch(
                          { notify_all_bookings: v },
                          v
                            ? "Du får besked om alle bookinger."
                            : "Du får kun besked om dine egne bookinger.",
                        )
                      }
                      title="Besked om alle bookinger"
                      description="Som ejer: også når kunder booker hos dine medarbejdere."
                    />
                  </div>
                ) : null}
              </div>
              <PushControl userId={me.userId} />
            </section>

            <section aria-labelledby="profil" className="grid gap-6">
              <h2 id="profil" className="text-2xl leading-8 text-text">
                Profil
              </h2>
              <TextField
                label="Navn (vises for kunderne)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="Telefon"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                optional
              />
              <Button
                className="justify-self-start"
                onClick={() =>
                  patch(
                    { display_name: name.trim(), phone: phone.trim() || null },
                    "Profilen er gemt.",
                  )
                }
              >
                Gem profil
              </Button>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function PushControl({ userId }: { userId: string }) {
  const config = useQuery({ queryKey: ["push-config"], queryFn: () => fetchPushConfig() });
  const [state, setState] = useState<PushState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const key = config.data?.vapidPublicKey ?? null;

  useEffect(() => {
    if (config.isSuccess) void pushState(key).then(setState);
  }, [config.isSuccess, key]);

  if (!state) return <Spinner label="Tjekker push …" />;

  const toggle = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setState(state.kind === "on" ? await disablePush() : await enablePush(key!, userId));
    } catch {
      setError("Push kunne ikke slås til. Prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 border border-line-strong p-4">
      <p className="text-base font-medium text-text">Push på denne enhed</p>
      {error ? <Notice tone="error" title={error} /> : null}
      {state.kind === "ios-needs-install" ? (
        <Notice title="Føj appen til hjemmeskærmen.">
          På iPhone virker notifikationer kun fra hjemmeskærmen: tryk på Del{" "}
          <Share aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> og vælg "Føj til
          hjemmeskærm". Åbn appen derfra, og slå push til her.
        </Notice>
      ) : state.kind === "unsupported" ? (
        <Notice title="Denne browser understøtter ikke push.">
          Du får stadig besked i notifikationscenteret og på mail.
        </Notice>
      ) : state.kind === "not-configured" ? (
        <Notice title="Push er ikke sat op endnu.">
          Salonens push-nøgler mangler. Du får besked i notifikationscenteret og på mail.
        </Notice>
      ) : state.kind === "denied" ? (
        <Notice title="Notifikationer er blokeret for appen.">
          Du har afvist tilladelsen. Slå den til igen i telefonens eller browserens indstillinger
          for siden – så kan du aktivere push her.
        </Notice>
      ) : (
        <>
          <p className="text-sm text-text-2">
            {state.kind === "on"
              ? "Push er slået til på denne enhed."
              : "Få besked på telefonen, også når appen er lukket."}
          </p>
          <Button
            variant={state.kind === "on" ? "secondary" : "primary"}
            size="sm"
            className="justify-self-start"
            onClick={toggle}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {state.kind === "on" ? "Slå push fra" : "Slå notifikationer til"}
          </Button>
        </>
      )}
    </div>
  );
}
