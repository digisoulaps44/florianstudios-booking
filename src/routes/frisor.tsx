import { createFileRoute, redirect } from "@tanstack/react-router";

/** Gammel adresse fra før frisøren blev trin 1. Sender til forsiden, hvor man vælger frisør. */
export const Route = createFileRoute("/frisor")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
