import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Button, Monogram, Notice, Spinner, TextField } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { notifySuccess } from "@/lib/notify";
import { useMe, useStaffList } from "@/lib/staff-data";
import { inviteStaffSchema } from "@/lib/staff-schemas";
import { inviteStaffMember, setStaffMemberActive } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/medarbejdere")({ component: StaffAdmin });

type InviteErrors = {
  displayName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
};

function StaffAdmin() {
  const me = useMe();
  const qc = useQueryClient();
  const staff = useStaffList();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();
  const [errors, setErrors] = useState<InviteErrors>({});

  if (!me.isOwner) return <Notice tone="error" title="Kun ejeren har adgang til medarbejdere." />;

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setMsg(undefined);
    // Samme schema som serveren, så fejl vises ved feltet i stedet for en generel fejl.
    const parsed = inviteStaffSchema.safeParse({ displayName: name, email, phone });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      const next = {
        displayName: fe.displayName?.[0],
        email: fe.email?.[0],
        phone: fe.phone?.[0] ? "Telefonnummeret er for langt." : undefined,
      };
      setErrors(next);
      const first = (["displayName", "email", "phone"] as const).find((k) => next[k]);
      if (first) document.getElementById(`invite-${first}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await inviteStaffMember({ data: parsed.data });
      if (r.ok) {
        notifySuccess(`Invitation sendt til ${parsed.data.displayName}`, {
          description: `Mailen går til ${parsed.data.email}. Vedkommende vælger selv adgangskode og dukker op her ved første login.`,
        });
        setName("");
        setEmail("");
        setPhone("");
        await qc.invalidateQueries({ queryKey: ["staff"] });
      } else setMsg({ tone: "error", text: r.message });
    } catch {
      setMsg({ tone: "error", text: "Invitationen kunne ikke sendes." });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (staffId: string, active: boolean) => {
    const r = await setStaffMemberActive({ data: { staffId, active } });
    const who = staff.data?.find((s) => s.id === staffId)?.display_name ?? "Medarbejderen";
    if (r.ok) {
      setMsg(undefined);
      notifySuccess(active ? `${who} er aktiveret` : `${who} er deaktiveret`, {
        description: active
          ? "Kan logge ind og bookes online igen."
          : "Kan ikke logge ind eller bookes online. Eksisterende bookinger er bevaret.",
      });
    } else setMsg({ tone: "error", text: r.message });
    await qc.invalidateQueries({ queryKey: ["staff"] });
  };

  return (
    <>
      <PageHeader eyebrow="Ejer" title="Medarbejdere." />
      <div className="grid max-w-text gap-10">
        {msg ? <Notice tone={msg.tone} title={msg.text} live reveal /> : null}
        {staff.isPending ? (
          <Spinner />
        ) : (
          <ul className="border-y border-line">
            {(staff.data ?? []).map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 py-4",
                  i > 0 && "border-t border-line",
                )}
              >
                <Monogram name={s.display_name} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-base font-medium",
                      s.active ? "text-text" : "text-text-muted",
                    )}
                  >
                    {s.display_name}
                  </p>
                  <p className="text-sm text-text-2">
                    {s.email} ·{" "}
                    {!s.active
                      ? "Deaktiveret"
                      : s.user_id
                        ? "Aktiv"
                        : "Inviteret – har ikke logget ind endnu"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-5">
                    <Link
                      to="/app/tider"
                      search={{ medarbejder: s.id }}
                      className="inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.18em] text-text-2 underline-offset-4 hover:text-text hover:underline"
                    >
                      Tider
                    </Link>
                    <Link
                      to="/app/behandlinger"
                      search={{ medarbejder: s.id }}
                      className="inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.18em] text-text-2 underline-offset-4 hover:text-text hover:underline"
                    >
                      Behandlinger
                    </Link>
                    <Link
                      to="/app/kalender"
                      search={{ medarbejder: s.id }}
                      className="inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.18em] text-text-2 underline-offset-4 hover:text-text hover:underline"
                    >
                      Kalender
                    </Link>
                  </div>
                </div>
                {s.id !== me.staffId ? (
                  <Button
                    variant={s.active ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => toggle(s.id, !s.active)}
                  >
                    {s.active ? "Deaktivér" : "Aktivér"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={invite} noValidate className="grid gap-4 border border-line-strong p-4">
          <h2 className="text-xl leading-7 text-text">Invitér medarbejder</h2>
          <TextField
            id="invite-displayName"
            label="Navn"
            autoComplete="off"
            error={errors.displayName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="invite-email"
            label="Mail"
            type="email"
            autoComplete="off"
            error={errors.email}
            autoCapitalize="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Telefon"
            id="invite-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            error={errors.phone}
            optional
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            type="submit"
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            className="justify-self-start"
          >
            {busy ? "Sender …" : "Send invitation"}
          </Button>
        </form>
      </div>
    </>
  );
}
