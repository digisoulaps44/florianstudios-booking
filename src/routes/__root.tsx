import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { buttonClasses } from "@/components/fs/primitives";

function NotFoundComponent() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-gutter">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">404</p>
        <h1 className="mt-4 text-3xl text-text">Siden findes ikke.</h1>
        <p className="mt-3 text-base text-text-2">
          Linket er måske forældet. Start forfra, og book din tid.
        </p>
        <div className="mt-8">
          <Link to="/" className={buttonClasses("primary", "md")}>
            Book tid
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-gutter">
      <div className="max-w-md text-center">
        <h1 className="text-3xl text-text">Siden kunne ikke vises.</h1>
        <p className="mt-3 text-base text-text-2">
          Der skete en fejl hos os. Prøv igen, eller ring til salonen på +45 71 53 07 66.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={buttonClasses("primary", "md")}
          >
            Prøv igen
          </button>
          <a href="/" className={buttonClasses("secondary", "md")}>
            Til forsiden
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#010101" },
      { title: "Book tid – Florian Studios" },
      {
        name: "description",
        content: "Book tid til herreklip og barbering hos Florian Studios i Herlev.",
      },
      { property: "og:title", content: "Book tid – Florian Studios" },
      {
        property: "og:description",
        content: "Book tid til herreklip og barbering hos Florian Studios i Herlev.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/playfair-700.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/inter.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
