import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button, Notice, Spinner, TextField } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration, formatPrice } from "@/lib/format";
import {
  useMe,
  useStaffList,
  useStaffTreatments,
  useTreatments,
  type StaffTreatmentRow,
} from "@/lib/staff-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/behandlinger")({
  validateSearch: z.object({ medarbejder: z.string().uuid().optional() }),
  component: Treatments,
});

function Treatments() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const staffList = useStaffList();
  const staffId = me.isOwner ? (search.medarbejder ?? me.staffId) : me.staffId;

  return (
    <>
      <PageHeader eyebrow="Behandlinger" title="Behandlinger og priser." />
      {me.isOwner ? (
        <label className="mb-8 grid max-w-sm gap-2">
          <span className="text-sm font-medium text-text">Medarbejder</span>
          <select
            value={staffId ?? ""}
            onChange={(e) => navigate({ search: { medarbejder: e.target.value } })}
            className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
          >
            <option value="" disabled>
              Vælg medarbejder
            </option>
            {(staffList.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {staffId ? (
        <StaffTreatments staffId={staffId} />
      ) : (
        <p className="text-text-2">Vælg en medarbejder.</p>
      )}
    </>
  );
}

const kr = (ore: number) => (ore / 100).toString().replace(".", ",");
const ore = (kr: string) => Math.round(Number(kr.replace(",", ".")) * 100);

function StaffTreatments({ staffId }: { staffId: string }) {
  const qc = useQueryClient();
  const offers = useStaffTreatments(staffId);
  const catalog = useTreatments();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [buffer, setBuffer] = useState("0");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["staff-treatments"] });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(undefined);
    const trimmed = name.trim();
    const p = ore(price);
    const d = Number(duration);
    const b = Number(buffer);
    if (
      !trimmed ||
      !Number.isFinite(p) ||
      p < 0 ||
      !(d >= 5 && d <= 480) ||
      !(b >= 0 && b <= 120)
    ) {
      setMsg({
        tone: "error",
        text: "Udfyld navn, pris (kr.), varighed (5–480 min) og buffer (0–120 min).",
      });
      return;
    }
    // Genbrug behandling fra kataloget med samme navn, ellers opret den.
    let treatment = (catalog.data ?? []).find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!treatment) {
      const created = await supabase.from("treatments").insert({ name: trimmed }).select().single();
      if (created.error) {
        setMsg({
          tone: "error",
          text: `Behandlingen kunne ikke oprettes: ${created.error.message}`,
        });
        return;
      }
      treatment = created.data;
      await qc.invalidateQueries({ queryKey: ["treatments"] });
    }
    const { error } = await supabase.from("staff_treatments").insert({
      staff_id: staffId,
      treatment_id: treatment.id,
      price_ore: p,
      duration_minutes: d,
      buffer_minutes: b,
    });
    if (error) {
      setMsg({
        tone: "error",
        text: error.code === "23505" ? "Behandlingen findes allerede på listen." : error.message,
      });
      return;
    }
    setName("");
    setPrice("");
    setMsg({ tone: "success", text: `${trimmed} er tilføjet.` });
    await invalidate();
  };

  if (offers.isPending) return <Spinner label="Henter behandlinger …" />;

  return (
    <div className="grid max-w-text gap-10">
      {msg ? <Notice tone={msg.tone} title={msg.text} live /> : null}
      <p className="text-sm text-text-2">
        Pris og varighed gemmes på hver booking. Ændringer her påvirker kun nye bookinger.
      </p>
      {(offers.data ?? []).length === 0 ? (
        <Notice title="Ingen behandlinger endnu.">
          Tilføj den første nedenfor – så kan kunderne booke dig online.
        </Notice>
      ) : (
        <ul className="border-y border-line-strong">
          {offers.data!.map((o, i) => (
            <OfferRow
              key={o.id}
              offer={o}
              first={i === 0}
              onSaved={invalidate}
              onError={(t) => setMsg({ tone: "error", text: t })}
            />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-4 border border-line-strong p-4">
        <h2 className="text-xl leading-7 text-text">Tilføj behandling</h2>
        <TextField
          label="Navn"
          list="katalog"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Vælg fra listen eller skriv en ny."
        />
        <datalist id="katalog">
          {(catalog.data ?? []).map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Pris (kr.)"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <TextField
            label="Varighed (min)"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <TextField
            label="Buffer (min)"
            inputMode="numeric"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </div>
        <Button type="submit" className="justify-self-start">
          Tilføj
        </Button>
      </form>
    </div>
  );
}

function OfferRow({
  offer,
  first,
  onSaved,
  onError,
}: {
  offer: StaffTreatmentRow;
  first: boolean;
  onSaved: () => void;
  onError: (t: string) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [price, setPrice] = useState(kr(offer.price_ore));
  const [duration, setDuration] = useState(String(offer.duration_minutes));
  const [buffer, setBuffer] = useState(String(offer.buffer_minutes));

  const save = async (
    patch: Partial<{
      price_ore: number;
      duration_minutes: number;
      buffer_minutes: number;
      active: boolean;
    }>,
  ) => {
    const { error } = await supabase.from("staff_treatments").update(patch).eq("id", offer.id);
    if (error) onError(error.message);
    else {
      setEdit(false);
      onSaved();
    }
  };

  return (
    <li className={cn("grid gap-3 py-4", !first && "border-t border-line-strong")}>
      <div className="flex items-baseline gap-4">
        <span
          className={cn(
            "font-display text-2xl leading-8 text-text",
            !offer.active && "text-text-muted",
          )}
        >
          {offer.treatment?.name}
        </span>
        <span aria-hidden="true" className="flex-1 border-b border-dotted border-line-strong" />
        <span className="whitespace-nowrap font-display text-2xl leading-8 text-text">
          {formatPrice(offer.price_ore)}
        </span>
      </div>
      <p className="text-sm text-text-2">
        {formatDuration(offer.duration_minutes)}
        {offer.buffer_minutes ? ` + ${offer.buffer_minutes} min buffer` : ""} ·{" "}
        {offer.active ? "Kan bookes" : "Skjult for kunder"}
      </p>
      {edit ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Pris (kr.)"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <TextField
            label="Varighed (min)"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <TextField
            label="Buffer (min)"
            inputMode="numeric"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
          <div className="flex flex-wrap gap-x-6 sm:col-span-3">
            <Button
              size="sm"
              onClick={() =>
                save({
                  price_ore: ore(price),
                  duration_minutes: Number(duration),
                  buffer_minutes: Number(buffer),
                })
              }
            >
              Gem
            </Button>
            <Button variant="ghost" onClick={() => setEdit(false)}>
              Annullér
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6">
          <Button variant="ghost" onClick={() => setEdit(true)}>
            Ret pris og tid
          </Button>
          <Button variant="ghost" onClick={() => save({ active: !offer.active })}>
            {offer.active ? "Skjul for kunder" : "Gør bookbar"}
          </Button>
        </div>
      )}
    </li>
  );
}
