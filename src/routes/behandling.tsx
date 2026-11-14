import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { BookBar, CustomerShell, OptionList, OptionRow, StepHeader } from "@/components/fs/booking";
import { Button, ButtonLink, Monogram, Notice } from "@/components/fs/primitives";
import { fetchBarberOffers } from "@/lib/booking.functions";
import { formatDuration, formatPrice } from "@/lib/format";
import { bookingSearch } from "@/lib/search-guard";

export const Route = createFileRoute("/behandling")({
  ...bookingSearch(z.object({ frisor: z.string().uuid() })),
  loaderDeps: ({ search }) => ({ frisor: search.frisor }),
  loader: ({ deps }) => fetchBarberOffers({ data: { staffId: deps.frisor } }),
  head: () => ({ meta: [{ title: "Vælg behandling – Florian Studios" }] }),
  component: ChooseTreatment,
});

/** Trin 2: den valgte frisørs behandlinger – med frisørens egne priser og varigheder. */
function ChooseTreatment() {
  const result = Route.useLoaderData();
  const { frisor } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>();
  const back = { to: "/", label: "Vælg frisør" };

  if (!result.ok) {
    return (
      <CustomerShell>
        <StepHeader step={2} title="Vælg behandling." back={back} />
        <Notice
          tone="error"
          title="Frisøren kan ikke bookes online lige nu."
          className="mt-8"
          actions={
            <ButtonLink to="/" variant="ghost">
              Vælg en anden frisør
            </ButtonLink>
          }
        >
          {result.message}
        </Notice>
      </CustomerShell>
    );
  }

  const offer = result.offers.find((o) => o.staffTreatmentId === selected);

  return (
    <CustomerShell
      bar={
        <BookBar
          summary={offer ? `${offer.name} · ${formatPrice(offer.priceOre)}` : result.barber.name}
          sub={
            offer
              ? `${result.barber.name} · ${formatDuration(offer.durationMinutes)}`
              : "Vælg en behandling"
          }
        >
          <Button
            disabled={!offer}
            onClick={() =>
              offer && navigate({ to: "/tid", search: { frisor, tilbud: offer.staffTreatmentId } })
            }
          >
            Vælg behandling
          </Button>
        </BookBar>
      }
    >
      <StepHeader
        step={2}
        title="Vælg behandling."
        back={back}
        lede={
          <span className="inline-flex items-center gap-3">
            <Monogram
              name={result.barber.name}
              src={result.barber.photoUrl ?? undefined}
              className="h-9 w-9 text-sm"
            />
            <span>Priser og tider hos {result.barber.name}.</span>
          </span>
        }
      />
      <div className="mt-8">
        <OptionList legend={`Behandlinger hos ${result.barber.name}`}>
          {result.offers.map((o) => (
            <OptionRow
              key={o.staffTreatmentId}
              name="behandling"
              value={o.staffTreatmentId}
              checked={o.staffTreatmentId === selected}
              onSelect={setSelected}
              title={o.name}
              meta={formatDuration(o.durationMinutes)}
              price={formatPrice(o.priceOre)}
            />
          ))}
        </OptionList>
      </div>
    </CustomerShell>
  );
}
