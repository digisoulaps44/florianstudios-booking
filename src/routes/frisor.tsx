import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { BookBar, CustomerShell, OptionList, OptionRow, StepHeader } from "@/components/fs/booking";
import { Button, ButtonLink, Monogram, Notice } from "@/components/fs/primitives";
import { fetchStaffOptions } from "@/lib/booking.functions";
import { formatDateShort, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { localDate } from "@/lib/tz";

export const Route = createFileRoute("/frisor")({
  validateSearch: z.object({ behandling: z.string().uuid() }),
  loaderDeps: ({ search }) => ({ behandling: search.behandling }),
  loader: ({ deps }) => fetchStaffOptions({ data: { treatmentId: deps.behandling } }),
  head: () => ({ meta: [{ title: "Vælg frisør – Florian Studios" }] }),
  component: ChooseStaff,
});

function nextLabel(iso: string | null): string {
  if (!iso) return "Ingen ledige tider de næste 3 uger";
  const d = new Date(iso);
  const today = localDate(new Date());
  const day = localDate(d);
  const tomorrow = localDate(new Date(Date.now() + 86_400_000));
  const when = day === today ? "i dag" : day === tomorrow ? "i morgen" : formatDateShort(d);
  return `Første ledige: ${when} ${formatTime(d)}`;
}

function ChooseStaff() {
  const result = Route.useLoaderData();
  const { behandling } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>();
  const back = { to: "/", label: "Vælg behandling" };

  if (!result.ok) {
    return (
      <CustomerShell>
        <StepHeader step={2} title="Vælg frisør." back={back} />
        <Notice
          tone="error"
          title="Frisørerne kunne ikke hentes."
          className="mt-8"
          actions={
            <ButtonLink to="/" variant="ghost">
              Vælg en anden behandling
            </ButtonLink>
          }
        >
          {result.message}
        </Notice>
      </CustomerShell>
    );
  }

  const choice = result.staff.find((s) => s.staffTreatmentId === selected);

  return (
    <CustomerShell
      bar={
        <BookBar
          summary={
            choice
              ? `${result.treatmentName} · ${formatPrice(choice.priceOre)}`
              : result.treatmentName
          }
          sub={
            choice ? `${choice.name} · ${formatDuration(choice.durationMinutes)}` : "Vælg en frisør"
          }
        >
          <Button
            disabled={!choice}
            onClick={() =>
              choice &&
              navigate({ to: "/tid", search: { behandling, tilbud: choice.staffTreatmentId } })
            }
          >
            Vælg frisør
          </Button>
        </BookBar>
      }
    >
      <StepHeader
        step={2}
        title="Vælg frisør."
        back={back}
        lede={`${result.treatmentName}. Pris og varighed kan variere fra frisør til frisør.`}
      />
      <div className="mt-8">
        <OptionList legend="Frisør">
          {result.staff.map((s) => (
            <OptionRow
              key={s.staffTreatmentId}
              name="frisor"
              value={s.staffTreatmentId}
              checked={s.staffTreatmentId === selected}
              onSelect={setSelected}
              leading={<Monogram name={s.name} />}
              title={s.name}
              titleClassName="font-body text-base leading-6 font-medium"
              meta={`${formatDuration(s.durationMinutes)} · ${formatPrice(s.priceOre)}`}
              extra={nextLabel(s.nextAvailable)}
            />
          ))}
        </OptionList>
      </div>
    </CustomerShell>
  );
}
