import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { BookBar, CustomerShell, OptionList, OptionRow, StepHeader } from "@/components/fs/booking";
import { Button, Notice } from "@/components/fs/primitives";
import { fetchCatalog } from "@/lib/booking.functions";
import { formatDuration, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book tid – Florian Studios" },
      {
        name: "description",
        content: "Vælg behandling, frisør og tid. Book online hos Florian Studios i Herlev.",
      },
      { property: "og:title", content: "Book tid – Florian Studios" },
      {
        property: "og:description",
        content: "Vælg behandling, frisør og tid. Book online hos Florian Studios i Herlev.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => fetchCatalog(),
  component: ChooseTreatment,
});

function ChooseTreatment() {
  const catalog = Route.useLoaderData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>();

  if (!catalog.ok) {
    return (
      <CustomerShell>
        <StepHeader step={1} title="Vælg behandling." />
        <Notice tone="error" title="Behandlingerne kunne ikke hentes." className="mt-8">
          {catalog.message}
        </Notice>
      </CustomerShell>
    );
  }

  const treatment = catalog.treatments.find((t) => t.id === selected);

  return (
    <CustomerShell
      bar={
        <BookBar
          summary={treatment ? treatment.name : "Ingen behandling valgt"}
          sub={treatment ? priceLabel(treatment.minPriceOre, treatment.maxPriceOre) : undefined}
        >
          <Button
            disabled={!treatment}
            onClick={() =>
              treatment && navigate({ to: "/frisor", search: { behandling: treatment.id } })
            }
          >
            Vælg behandling
          </Button>
        </BookBar>
      }
    >
      <StepHeader step={1} title="Vælg behandling." />
      <div className="mt-8">
        {catalog.treatments.length === 0 ? (
          <Notice title="Der kan ikke bookes online lige nu.">
            Ring til salonen på {catalog.salon.phone}, så finder vi en tid.
          </Notice>
        ) : (
          <OptionList legend="Behandling">
            {catalog.treatments.map((t) => (
              <OptionRow
                key={t.id}
                name="behandling"
                value={t.id}
                checked={t.id === selected}
                onSelect={setSelected}
                title={t.name}
                meta={durationLabel(t.minDuration, t.maxDuration)}
                price={priceLabel(t.minPriceOre, t.maxPriceOre)}
              />
            ))}
          </OptionList>
        )}
      </div>
      <p className="mt-8 text-sm text-text-2">
        Du får en bekræftelse på mail. Ændr eller aflys via linket i mailen frem til{" "}
        {catalog.salon.cancellationCutoffHours} timer før.
      </p>
    </CustomerShell>
  );
}

export function priceLabel(min: number, max: number) {
  return min === max ? formatPrice(min) : `fra ${formatPrice(min)}`;
}

export function durationLabel(min: number, max: number) {
  return min === max ? formatDuration(min) : `${formatDuration(min)}–${formatDuration(max)}`;
}
