import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank Project" },
      { name: "description", content: "A clean, empty starting point." },
      { property: "og:title", content: "Blank Project" },
      { property: "og:description", content: "A clean, empty starting point." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-2xl font-medium text-muted-foreground">Ready to build</h1>
    </main>
  );
}
