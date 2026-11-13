import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/fs/staff";
import { Button, Notice, Spinner } from "@/components/fs/primitives";
import { supabase } from "@/integrations/supabase/client";
import { MeContext, useLiveUpdates, useNotifications } from "@/lib/staff-data";
import { fetchMe } from "@/lib/staff.functions";

/** Medarbejder-/ejerappen. Kun klient-rendering: sessionen ligger i browseren. */
export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Florian Studios – medarbejdere" }, { name: "robots", content: "noindex" }],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === "out") void navigate({ to: "/login" });
  }, [session, navigate]);

  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe(), enabled: session === "in" });

  if (session !== "in" || me.isPending) return <Spinner label="Indlæser …" />;

  if (me.isError || (!me.data.staffId && !me.data.isOwner)) {
    return (
      <main className="mx-auto max-w-md px-gutter py-16">
        <Notice
          tone="error"
          title="Din konto har ikke adgang."
          actions={
            <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
              Log ud
            </Button>
          }
        >
          Kontoen er ikke knyttet til en aktiv medarbejder. Kontakt ejeren af salonen.
        </Notice>
      </main>
    );
  }

  return (
    <MeContext.Provider value={me.data}>
      <Shell />
    </MeContext.Provider>
  );
}

function Shell() {
  useLiveUpdates(true);
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return (
    <AppShell unread={unread}>
      <Outlet />
    </AppShell>
  );
}
