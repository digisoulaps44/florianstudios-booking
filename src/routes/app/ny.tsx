import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";

import { Button, CheckboxRow, Notice, TextField } from "@/components/fs/primitives";
import { StaffSlotPicker, type PickedTime } from "@/components/fs/slot-picker";
import { PageHeader } from "@/components/fs/staff";
import { formatDuration, formatPrice } from "@/lib/format";
import { useMe, useStaffList, useStaffTreatments } from "@/lib/staff-data";
import { staffCustomerSchema } from "@/lib/staff-schemas";
import { createStaffBooking } from "@/lib/staff.functions";
import { localDate, localTime } from "@/lib/tz";

export const Route = createFileRoute("/app/ny")({
  validateSearch: z.object({ start: z.string().datetime({ offset: true }).optional() }),
  component: NewBooking,
});

function NewBooking() {
  const me = useMe();
  const { start } = Route.useSearch();
  const navigate = useNavigate();
  const staffList = useStaffList();
  const [staffId, setStaffId] = useState<string | null>(me.staffId);
  const offers = useStaffTreatments(staffId);
  const [offerId, setOfferId] = useState<string>();
  const [picked, setPicked] = useState<PickedTime>(null);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    whatsappOptIn: false,
  });
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => crypto.randomUUID());

  const activeOffers = useMemo(
    () => (offers.data ?? []).filter((o) => o.active && o.treatment?.active),
    [offers.data],
  );
  const offer = activeOffers.find((o) => o.id === offerId);
  const onPicked = useCallback((p: PickedTime) => setPicked(p), []);
  const initialDate = start ? localDate(new Date(start)) : localDate(new Date());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setProblem(undefined);
    const parsed = staffCustomerSchema.safeParse(customer);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success)
      for (const i of parsed.error.issues) nextErrors[String(i.path[0])] ??= i.message;
    if (!offer) nextErrors["offer"] = "Vælg en behandling.";
    if (!picked) nextErrors["time"] = "Vælg et tidspunkt.";
    setErrors(nextErrors);
    const first = ["offer", "time", "name", "phone", "email"].find((k) => nextErrors[k]);
    if (first) document.getElementById(`ny-${first}`)?.focus();
    if (Object.keys(nextErrors).length || !offer || !picked) return;
    setBusy(true);
    try {
      const r = await createStaffBooking({
        data: {
          staffTreatmentId: offer.id,
          startsAt: picked.startsAt,
          customer,
          note,
          ignoreSchedule: picked.ignoreSchedule,
          idempotencyKey: idem,
        },
      });
      if (r.ok) await navigate({ to: "/app/booking/$id", params: { id: r.bookingId } });
      else setProblem(r.message);
    } catch {
      setProblem("Bookingen kunne ikke oprettes. Prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Ny booking" title="Opret booking." />
      <form onSubmit={submit} noValidate className="grid max-w-text gap-10">
        {problem ? <Notice tone="error" title={problem} reveal /> : null}

        {me.isOwner ? (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Medarbejder</span>
            <select
              value={staffId ?? ""}
              onChange={(e) => {
                setStaffId(e.target.value || null);
                setOfferId(undefined);
              }}
              className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
            >
              <option value="">Vælg medarbejder</option>
              {(staffList.data ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-2">
          <label htmlFor="ny-offer" className="mb-2 text-sm font-medium text-text">
            Behandling
          </label>
          {staffId && activeOffers.length === 0 && !offers.isPending ? (
            <Notice title="Ingen aktive behandlinger.">
              Opret behandlinger under Mere → Behandlinger.
            </Notice>
          ) : (
            <select
              id="ny-offer"
              value={offerId ?? ""}
              onChange={(e) => setOfferId(e.target.value || undefined)}
              aria-invalid={errors["offer"] ? true : undefined}
              aria-describedby={errors["offer"] ? "ny-behandling-fejl" : undefined}
              className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
            >
              <option value="">Vælg behandling</option>
              {activeOffers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.treatment?.name} · {formatDuration(o.duration_minutes)} ·{" "}
                  {formatPrice(o.price_ore)}
                </option>
              ))}
            </select>
          )}
          {errors["offer"] ? (
            <p id="ny-behandling-fejl" className="text-sm text-closed">
              {errors["offer"]}
            </p>
          ) : null}
        </div>

        <section aria-label="Tidspunkt" className="grid gap-2">
          <h2 id="ny-time" tabIndex={-1} className="text-xl leading-7 text-text">
            Tidspunkt
          </h2>
          <StaffSlotPicker
            staffTreatmentId={offer?.id}
            initialDate={initialDate}
            initialTime={start ? localTime(new Date(start)) : undefined}
            onChange={onPicked}
          />
          {errors["time"] ? (
            <p role="alert" className="text-sm text-closed">
              {errors["time"]}
            </p>
          ) : null}
        </section>

        <section aria-label="Kunde" className="grid gap-6">
          <h2 className="text-xl leading-7 text-text">Kunde</h2>
          <TextField
            id="ny-name"
            label="Navn"
            autoComplete="off"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            error={errors["name"]}
          />
          <TextField
            id="ny-phone"
            label="Telefon"
            type="tel"
            inputMode="tel"
            prefix="+45"
            autoComplete="off"
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            error={errors["phone"]}
          />
          <TextField
            id="ny-email"
            label="Mail"
            optional
            type="email"
            autoCapitalize="off"
            spellCheck={false}
            hint="Med mail får kunden bekræftelse, påmindelse og link til at ændre tiden."
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            error={errors["email"]}
          />
          <CheckboxRow
            checked={customer.whatsappOptIn}
            onChange={(v) => setCustomer({ ...customer, whatsappOptIn: v })}
            title="Kunden ønsker beskeder på WhatsApp"
            description="Kun hvis kunden selv har sagt ja."
          />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">
              Note <span className="font-normal text-text-muted">(valgfri, kun internt)</span>
            </span>
            <textarea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="border border-control bg-ink-3 px-4 py-3 text-base text-text"
            />
          </label>
        </section>

        <div className="pb-safe sticky bottom-16 z-10 -mx-gutter border-t border-line-strong bg-ink/95 px-gutter pt-3 backdrop-blur md:bottom-0">
          <Button
            type="submit"
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            className="w-full sm:w-auto"
          >
            {busy ? "Opretter …" : "Opret booking"}
          </Button>
        </div>
      </form>
    </>
  );
}
