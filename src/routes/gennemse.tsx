import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  BookBar,
  CustomerShell,
  StepHeader,
  SummaryList,
  TimeSlots,
} from "@/components/fs/booking";
import { Button, ButtonLink, Notice } from "@/components/fs/primitives";
import { submitBooking, fetchStaffOptions } from "@/lib/booking.functions";
import { customerSchema } from "@/lib/booking-schemas";
import { clearIdempotencyKey, idempotencyKeyFor, useCustomerDraft } from "@/lib/customer-draft";
import { formatDuration, formatPrice, formatWhen } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";

const search = z.object({
  behandling: z.string().uuid(),
  tilbud: z.string().uuid(),
  tid: z.string().datetime({ offset: true }),
});

export const Route = createFileRoute("/gennemse")({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ behandling: search.behandling }),
  loader: ({ deps }) => fetchStaffOptions({ data: { treatmentId: deps.behandling } }),
  head: () => ({ meta: [{ title: "Gennemse booking – Florian Studios" }] }),
  component: Review,
});

type Problem = {
  message: string;
  alternatives?: Array<{ startsAt: string; time: string }> | undefined;
};

function Review() {
  const options = Route.useLoaderData();
  const s = Route.useSearch();
  const navigate = useNavigate();
  const { draft, loaded } = useCustomerDraft();
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<Problem>();
  const inFlight = useRef(false);

  const offer = options.ok ? options.staff.find((x) => x.staffTreatmentId === s.tilbud) : undefined;
  const contactValid = customerSchema.safeParse(draft).success;

  // Uden kontaktoplysninger (fx nyt faneblad) sendes kunden tilbage til trin 4.
  useEffect(() => {
    if (loaded && !contactValid) navigate({ to: "/oplysninger", search: s, replace: true });
  }, [loaded, contactValid, navigate, s]);

  const confirm = async () => {
    if (inFlight.current || !offer) return; // Gentagne klik sender ikke en ny booking.
    inFlight.current = true;
    setSubmitting(true);
    setProblem(undefined);
    const selection = `${s.tilbud}|${s.tid}`;
    try {
      const result = await submitBooking({
        data: {
          staffTreatmentId: s.tilbud,
          startsAt: s.tid,
          customer: draft,
          idempotencyKey: idempotencyKeyFor(selection),
          company: "",
        },
      });
      if (result.ok) {
        clearIdempotencyKey(selection);
        navigate({
          to: "/booking/$token",
          params: { token: result.manageToken },
          search: { ny: 1 },
        });
        return;
      }
      setProblem({
        message: result.message,
        alternatives: "alternatives" in result ? result.alternatives : undefined,
      });
    } catch {
      setProblem({
        message: "Bookingen kunne ikke gennemføres. Tjek din forbindelse, og prøv igen.",
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (!options.ok || !offer) {
    return (
      <CustomerShell>
        <StepHeader step={5} title="Gennemse og bekræft." />
        <Notice
          tone="error"
          title="Behandlingen kan ikke bookes lige nu."
          className="mt-8"
          actions={
            <ButtonLink to="/" variant="ghost">
              Start forfra
            </ButtonLink>
          }
        />
      </CustomerShell>
    );
  }

  const start = new Date(s.tid);
  const phone = normalizePhone(draft.phone);
  const timeSearch = { behandling: s.behandling, tilbud: s.tilbud };

  return (
    <CustomerShell
      bar={
        <BookBar
          summary={`${options.treatmentName} · ${formatPrice(offer.priceOre)}`}
          sub={formatWhen(start)}
        >
          <Button
            onClick={confirm}
            disabled={submitting || !contactValid}
            aria-busy={submitting || undefined}
          >
            {submitting ? "Booker …" : "Bekræft booking"}
          </Button>
        </BookBar>
      }
    >
      <StepHeader
        step={5}
        title="Gennemse og bekræft."
        back={{ to: "/oplysninger", search: s, label: "Dine oplysninger" }}
      />

      {problem ? (
        <div className="mt-8 grid gap-6">
          <Notice tone="error" title={problem.message}>
            {problem.alternatives?.length ? "Her er de ledige tider samme dag." : null}
          </Notice>
          {problem.alternatives?.length ? (
            <TimeSlots
              slots={problem.alternatives}
              selected={undefined}
              label="Andre ledige tider"
              onSelect={(slot) => {
                setProblem(undefined);
                navigate({ to: "/gennemse", search: { ...s, tid: slot.startsAt }, replace: true });
              }}
            />
          ) : (
            <ButtonLink
              to="/tid"
              search={timeSearch}
              variant="secondary"
              size="sm"
              className="justify-self-start"
            >
              Vælg en anden tid
            </ButtonLink>
          )}
        </div>
      ) : null}

      <div className="mt-8">
        <SummaryList
          rows={[
            {
              term: "Behandling",
              value: `${options.treatmentName} · ${formatDuration(offer.durationMinutes)}`,
              edit: { to: "/", label: "behandling" },
            },
            {
              term: "Frisør",
              value: offer.name,
              edit: { to: "/frisor", search: { behandling: s.behandling }, label: "frisør" },
            },
            {
              term: "Tidspunkt",
              value: formatWhen(start),
              edit: { to: "/tid", search: timeSearch, label: "tidspunkt" },
            },
            {
              term: "Kontakt",
              value: (
                <>
                  {draft.name} · {phone ? formatPhone(phone) : draft.phone}
                  <br />
                  {draft.email}
                  {draft.whatsappOptIn ? (
                    <>
                      <br />
                      <span className="text-text-2">
                        Bekræftelse og påmindelse også på WhatsApp
                      </span>
                    </>
                  ) : null}
                </>
              ),
              edit: { to: "/oplysninger", search: s, label: "kontaktoplysninger" },
            },
          ]}
          total={{ term: "Pris", value: formatPrice(offer.priceOre) }}
        />
      </div>
      <p className="mt-4 text-sm text-text-2">
        Du kan ændre eller aflyse via linket i bekræftelsen.
      </p>
    </CustomerShell>
  );
}
