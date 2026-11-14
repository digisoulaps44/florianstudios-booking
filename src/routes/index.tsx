import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { BookBar, CustomerShell, OptionList, OptionRow, StepHeader } from "@/components/fs/booking";
import { Button, Monogram, Notice } from "@/components/fs/primitives";
import { fetchBarbers } from "@/lib/booking.functions";
import { nextAvailableLabel, priceRangeLabel, treatmentCountLabel } from "@/lib/booking-labels";

const DESCRIPTION = "Vælg frisør, behandling og tid. Book online hos Florian Studios i Herlev.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book tid – Florian Studios" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Book tid – Florian Studios" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => fetchBarbers(),
  component: ChooseBarber,
});

/** Trin 1: kunden vælger sin frisør. Priserne afhænger af frisøren og vises i trin 2. */
function ChooseBarber() {
  const result = Route.useLoaderData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>();

  if (!result.ok) {
    return (
      <CustomerShell>
        <StepHeader step={1} title="Vælg frisør." />
        <Notice tone="error" title="Frisørerne kunne ikke hentes." className="mt-8">
          {result.message}
        </Notice>
      </CustomerShell>
    );
  }

  const barber = result.barbers.find((b) => b.id === selected);

  return (
    <CustomerShell
      bar={
        result.barbers.length === 0 ? undefined : (
          <BookBar
            summary={barber ? barber.name : "Ingen frisør valgt"}
            sub={
              barber
                ? `${treatmentCountLabel(barber.treatmentCount)} · ${priceRangeLabel(barber.minPriceOre, barber.maxPriceOre)}`
                : undefined
            }
          >
            <Button
              disabled={!barber}
              onClick={() =>
                barber && navigate({ to: "/behandling", search: { frisor: barber.id } })
              }
            >
              Vælg frisør
            </Button>
          </BookBar>
        )
      }
    >
      <StepHeader
        step={1}
        title="Vælg frisør."
        lede={
          result.barbers.length > 1
            ? "Hver frisør har sine egne priser. Du ser dem i næste trin."
            : undefined
        }
      />
      <div className="mt-8">
        {result.barbers.length === 0 ? (
          <Notice title="Der kan ikke bookes online lige nu.">
            Ring til salonen på {result.salon.phone}, så finder vi en tid.
          </Notice>
        ) : (
          <OptionList legend="Frisør">
            {result.barbers.map((b) => (
              <OptionRow
                key={b.id}
                name="frisor"
                value={b.id}
                checked={b.id === selected}
                onSelect={setSelected}
                leading={<Monogram name={b.name} src={b.photoUrl ?? undefined} />}
                title={b.name}
                titleClassName="font-body text-base leading-6 font-medium"
                meta={`${treatmentCountLabel(b.treatmentCount)} · ${priceRangeLabel(b.minPriceOre, b.maxPriceOre)}`}
                extra={nextAvailableLabel(b.nextAvailable)}
              />
            ))}
          </OptionList>
        )}
      </div>
      <p className="mt-8 text-sm text-text-2">
        Du får en bekræftelse på mail. Ændr eller aflys via linket i mailen frem til{" "}
        {result.salon.cancellationCutoffHours} timer før.
      </p>
    </CustomerShell>
  );
}
