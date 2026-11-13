import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { Button, Notice, TextField } from "@/components/fs/primitives";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: z.object({
    velkommen: z.coerce.number().optional(),
    nulstil: z.coerce.number().optional(),
  }),
  head: () => ({
    meta: [{ title: "Log ind – Florian Studios" }, { name: "robots", content: "noindex" }],
  }),
  component: Login,
});

type Mode = "login" | "forgot" | "set-password";

function Login() {
  const { velkommen, nulstil } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(velkommen || nulstil ? "set-password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  // Invitations- og nulstillingslinks logger brugeren ind via URL'en; send videre hvis der allerede er en session.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && mode === "login") void navigate({ to: "/app" });
    });
  }, [mode, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError("Forkert mail eller adgangskode.");
        else await navigate({ to: "/app" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login?nulstil=1`,
        });
        if (error) setError("Linket kunne ikke sendes. Prøv igen om lidt.");
        else setInfo("Tjek din mail – vi har sendt et link til at vælge en ny adgangskode.");
      } else {
        if (password.length < 10) {
          setError("Adgangskoden skal være mindst 10 tegn.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setError("Adgangskoden kunne ikke gemmes. Åbn linket i mailen igen.");
        else await navigate({ to: "/app" });
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "login" ? "Log ind." : mode === "forgot" ? "Glemt adgangskode." : "Vælg adgangskode.";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-gutter py-12">
      <div className="w-full max-w-sm">
        <p className="mb-10 inline-flex items-center gap-2 font-display text-lg tracking-[0.2em] uppercase text-text">
          Florian Studios <Scissors aria-hidden="true" className="h-4 w-4" />
        </p>
        <h1 className="text-3xl leading-9 text-text">{title}</h1>
        <p className="mt-2 text-base text-text-2">
          {mode === "set-password"
            ? "Velkommen. Vælg en adgangskode til din konto."
            : "Til medarbejdere hos Florian Studios."}
        </p>
        <form onSubmit={submit} className="mt-8 grid gap-6" noValidate>
          {error ? <Notice tone="error" title={error} /> : null}
          {info ? <Notice tone="success" title={info} live /> : null}
          {mode !== "set-password" ? (
            <TextField
              label="Mail"
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          ) : null}
          {mode !== "forgot" ? (
            <TextField
              label={mode === "set-password" ? "Ny adgangskode" : "Adgangskode"}
              type="password"
              autoComplete={mode === "set-password" ? "new-password" : "current-password"}
              hint={mode === "set-password" ? "Mindst 10 tegn." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          ) : null}
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy
              ? "Et øjeblik …"
              : mode === "login"
                ? "Log ind"
                : mode === "forgot"
                  ? "Send link"
                  : "Gem adgangskode"}
          </Button>
          {mode === "login" ? (
            <Button
              variant="ghost"
              onClick={() => setMode("forgot")}
              className="justify-self-start"
            >
              Glemt adgangskode?
            </Button>
          ) : mode === "forgot" ? (
            <Button variant="ghost" onClick={() => setMode("login")} className="justify-self-start">
              Tilbage til log ind
            </Button>
          ) : null}
        </form>
      </div>
    </main>
  );
}
