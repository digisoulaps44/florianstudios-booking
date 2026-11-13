import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { BookBar, CustomerShell, StepHeader } from "@/components/fs/booking";
import { Button, CheckboxRow, TextField } from "@/components/fs/primitives";
import { customerSchema } from "@/lib/booking-schemas";
import { useCustomerDraft } from "@/lib/customer-draft";
import { formatTime } from "@/lib/format";

export const Route = createFileRoute("/oplysninger")({
  validateSearch: z.object({
    behandling: z.string().uuid(),
    tilbud: z.string().uuid(),
    tid: z.string().datetime({ offset: true }),
  }),
  head: () => ({ meta: [{ title: "Dine oplysninger – Florian Studios" }] }),
  component: CustomerDetails,
});

type Errors = Partial<Record<"name" | "phone" | "email", string>>;

function CustomerDetails() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { draft, update } = useCustomerDraft();
  const [errors, setErrors] = useState<Errors>({});

  const validateField = (field: keyof Errors) => {
    const result = customerSchema.safeParse(draft);
    const issue = result.success ? undefined : result.error.issues.find((i) => i.path[0] === field);
    setErrors((e) => ({ ...e, [field]: issue?.message }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = customerSchema.safeParse(draft);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      const first = (["name", "phone", "email"] as const).find((k) => next[k]);
      if (first) document.getElementById(`felt-${first}`)?.focus();
      return;
    }
    navigate({ to: "/gennemse", search });
  };

  return (
    <CustomerShell
      bar={
        <BookBar summary={`Kl. ${formatTime(new Date(search.tid))}`} sub="Udfyld dine oplysninger">
          <Button type="submit" form="kunde">
            Gennemse booking
          </Button>
        </BookBar>
      }
    >
      <StepHeader
        step={4}
        title="Dine oplysninger."
        back={{
          to: "/tid",
          search: { behandling: search.behandling, tilbud: search.tilbud },
          label: "Vælg tidspunkt",
        }}
        lede="Vi bruger dem kun til din booking."
      />
      <form id="kunde" noValidate onSubmit={submit} className="mt-8 grid gap-6">
        <TextField
          id="felt-name"
          label="Navn"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={() => draft.name && validateField("name")}
          error={errors.name}
        />
        <TextField
          id="felt-phone"
          label="Mobilnummer"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          prefix="+45"
          value={draft.phone}
          onChange={(e) => update({ phone: e.target.value })}
          onBlur={() => draft.phone && validateField("phone")}
          error={errors.phone}
        />
        <TextField
          id="felt-email"
          label="Mail"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="navn@mail.dk"
          hint="Vi sender bekræftelsen og linket til at ændre din tid hertil."
          value={draft.email}
          onChange={(e) => update({ email: e.target.value })}
          onBlur={() => draft.email && validateField("email")}
          error={errors.email}
        />
        <div className="border-t border-line pt-2">
          <CheckboxRow
            name="whatsapp"
            checked={!!draft.whatsappOptIn}
            onChange={(checked) => update({ whatsappOptIn: checked })}
            title="Send bekræftelse og påmindelse på WhatsApp"
            description="Til mobilnummeret ovenfor. Du får altid en mail."
          />
        </div>
      </form>
    </CustomerShell>
  );
}
