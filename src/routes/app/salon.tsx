import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Button, Notice, Spinner, TextField } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useSettings } from "@/lib/staff-data";

export const Route = createFileRoute("/app/salon")({ component: SalonSettings });

type Form = {
  name: string;
  address_line: string;
  phone: string;
  cancellation_cutoff_hours: string;
  reminder_hours_before: string;
  booking_horizon_days: string;
  slot_interval_minutes: string;
  min_notice_minutes: string;
};

function SalonSettings() {
  const me = useMe();
  const qc = useQueryClient();
  const settings = useSettings();
  const [form, setForm] = useState<Form>();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  useEffect(() => {
    const s = settings.data;
    if (s)
      setForm({
        name: s.name,
        address_line: s.address_line,
        phone: s.phone,
        cancellation_cutoff_hours: String(s.cancellation_cutoff_hours),
        reminder_hours_before: String(s.reminder_hours_before),
        booking_horizon_days: String(s.booking_horizon_days),
        slot_interval_minutes: String(s.slot_interval_minutes),
        min_notice_minutes: String(s.min_notice_minutes),
      });
  }, [settings.data]);

  if (!me.isOwner)
    return <Notice tone="error" title="Kun ejeren kan ændre salonens indstillinger." />;
  if (!form) return <Spinner />;

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("salon_settings")
      .update({
        name: form.name.trim(),
        address_line: form.address_line.trim(),
        phone: form.phone.trim(),
        cancellation_cutoff_hours: Number(form.cancellation_cutoff_hours),
        reminder_hours_before: Number(form.reminder_hours_before),
        booking_horizon_days: Number(form.booking_horizon_days),
        slot_interval_minutes: Number(form.slot_interval_minutes),
        min_notice_minutes: Number(form.min_notice_minutes),
      })
      .eq("id", 1);
    setMsg(
      error
        ? { tone: "error", text: `Kunne ikke gemmes: ${error.message}` }
        : { tone: "success", text: "Indstillingerne er gemt." },
    );
    await qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <>
      <PageHeader eyebrow="Ejer" title="Salonindstillinger." />
      <form onSubmit={save} noValidate className="grid max-w-text gap-6">
        {msg ? <Notice tone={msg.tone} title={msg.text} live /> : null}
        <TextField label="Salonens navn" value={form.name} onChange={set("name")} />
        <TextField
          label="Adresse"
          value={form.address_line}
          onChange={set("address_line")}
          hint="Står i mails og på bekræftelsen."
        />
        <TextField label="Telefon" type="tel" value={form.phone} onChange={set("phone")} />
        <TextField
          label="Afbestillingsfrist (timer)"
          inputMode="numeric"
          value={form.cancellation_cutoff_hours}
          onChange={set("cancellation_cutoff_hours")}
          hint="Hvor længe før tiden kunden selv kan ændre eller aflyse online (0–168)."
        />
        <TextField
          label="Påmindelse (timer før)"
          inputMode="numeric"
          value={form.reminder_hours_before}
          onChange={set("reminder_hours_before")}
          hint="Standard 24. Bookinger oprettet tættere på tiden får ingen påmindelse (1–168)."
        />
        <TextField
          label="Bookingvindue (dage frem)"
          inputMode="numeric"
          value={form.booking_horizon_days}
          onChange={set("booking_horizon_days")}
          hint="1–365."
        />
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Tidsinterval</span>
          <select
            value={form.slot_interval_minutes}
            onChange={set("slot_interval_minutes")}
            className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
          >
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                Hvert {m}. minut
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Mindste varsel (minutter)"
          inputMode="numeric"
          value={form.min_notice_minutes}
          onChange={set("min_notice_minutes")}
          hint="Hvor tæt på tiden kunder kan booke online (0–2880)."
        />
        <Button type="submit" className="justify-self-start">
          Gem indstillinger
        </Button>
      </form>
    </>
  );
}
