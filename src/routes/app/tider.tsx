import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";

import { Button, Notice, Spinner } from "@/components/fs/primitives";
import { PageHeader, findConflicts } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { formatDateShort, formatTime, formatWhen } from "@/lib/format";
import {
  useBookings,
  useExceptions,
  useMe,
  useStaffList,
  useWeekly,
  type WeeklyRow,
} from "@/lib/staff-data";
import { addDays, localDate, zonedToUtc } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tider")({
  validateSearch: z.object({ medarbejder: z.string().uuid().optional() }),
  component: Schedule,
});

const DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const KIND_LABEL = {
  vacation: "Ferie",
  absence: "Fravær",
  block: "Blokering",
  extra_work: "Ekstra arbejdstid",
} as const;
type ExcKind = keyof typeof KIND_LABEL;

function Schedule() {
  const me = useMe();
  const search = Route.useSearch();
  const staffList = useStaffList();
  const staffId = me.isOwner ? (search.medarbejder ?? me.staffId) : me.staffId;
  const navigate = Route.useNavigate();

  if (!staffId) {
    return (
      <>
        <PageHeader eyebrow="Arbejdstider" title="Vælg medarbejder." />
        <StaffPicker
          list={staffList.data ?? []}
          value={undefined}
          onChange={(id) => navigate({ search: { medarbejder: id } })}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Arbejdstider" title="Tider og fravær." />
      {me.isOwner ? (
        <div className="mb-8">
          <StaffPicker
            list={staffList.data ?? []}
            value={staffId}
            onChange={(id) => navigate({ search: { medarbejder: id } })}
          />
        </div>
      ) : null}
      <div className="grid max-w-text gap-12">
        <WeeklyEditor staffId={staffId} />
        <Exceptions staffId={staffId} />
      </div>
    </>
  );
}

function StaffPicker({
  list,
  value,
  onChange,
}: {
  list: Array<{ id: string; display_name: string; active: boolean }>;
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <label className="grid max-w-sm gap-2">
      <span className="text-sm font-medium text-text">Medarbejder</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
      >
        <option value="" disabled>
          Vælg medarbejder
        </option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.display_name}
            {s.active ? "" : " (deaktiveret)"}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Ugeskema ─────────────────────────────────────────────────────────────
type Row = { kind: "work" | "break"; start: string; end: string };

function WeeklyEditor({ staffId }: { staffId: string }) {
  const weekly = useWeekly(staffId);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<number, Row[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  const current = useMemo(() => {
    const map: Record<number, Row[]> = {};
    for (let d = 1; d <= 7; d++) map[d] = [];
    for (const w of weekly.data ?? [])
      map[w.weekday]!.push({
        kind: w.kind as Row["kind"],
        start: w.start_time.slice(0, 5),
        end: w.end_time.slice(0, 5),
      });
    return map;
  }, [weekly.data]);
  const rows = draft ?? current;

  const update = (day: number, next: Row[]) => setDraft({ ...rows, [day]: next });

  const save = async () => {
    const invalid = Object.values(rows)
      .flat()
      .find((r) => !(r.end > r.start));
    if (invalid) {
      setMsg({ tone: "error", text: "Et tidsrum slutter før det starter. Ret det, og gem igen." });
      return;
    }
    setBusy(true);
    setMsg(undefined);
    // Erstat ugeskemaet. Eksisterende bookinger røres ikke – de vises som konflikter, hvis de falder udenfor.
    const del = await supabase.from("weekly_schedule").delete().eq("staff_id", staffId);
    const insertRows = Object.entries(rows).flatMap(([day, list]) =>
      list.map((r) => ({
        staff_id: staffId,
        weekday: Number(day),
        kind: r.kind,
        start_time: r.start,
        end_time: r.end,
      })),
    );
    const ins = del.error
      ? del
      : insertRows.length
        ? await supabase.from("weekly_schedule").insert(insertRows)
        : { error: null };
    setBusy(false);
    if (ins.error)
      setMsg({ tone: "error", text: `Arbejdstiderne kunne ikke gemmes: ${ins.error.message}` });
    else {
      setDraft(null);
      setMsg({ tone: "success", text: "Arbejdstiderne er gemt." });
      await qc.invalidateQueries({ queryKey: ["weekly", staffId] });
    }
  };

  if (weekly.isPending) return <Spinner label="Henter arbejdstider …" />;

  return (
    <section aria-labelledby="uge-titel" className="grid gap-4">
      <h2 id="uge-titel" className="text-2xl leading-8 text-text">
        Ugentlige arbejdstider
      </h2>
      <p className="text-sm text-text-2">
        Ændringer flytter eller sletter aldrig eksisterende bookinger. Bookinger uden for de nye
        tider vises som konflikter.
      </p>
      {msg ? <Notice tone={msg.tone} title={msg.text} live reveal /> : null}
      <ul className="border-y border-line">
        {DAYS.map((label, i) => {
          const day = i + 1;
          const list = rows[day] ?? [];
          return (
            <li key={day} className={cn("grid gap-3 py-4", i > 0 && "border-t border-line")}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm uppercase tracking-[0.15em] text-text">{label}</span>
                {list.length === 0 ? <span className="text-sm text-text-muted">Fri</span> : null}
              </div>
              {list.map((r, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`${label}: type`}
                    value={r.kind}
                    onChange={(e) =>
                      update(
                        day,
                        list.map((x, j) =>
                          j === idx ? { ...x, kind: e.target.value as Row["kind"] } : x,
                        ),
                      )
                    }
                    className="min-h-11 border border-control bg-ink-3 px-3 text-base text-text"
                  >
                    <option value="work">Arbejde</option>
                    <option value="break">Pause</option>
                  </select>
                  <input
                    aria-label={`${label}: fra`}
                    type="time"
                    step={300}
                    value={r.start}
                    onChange={(e) =>
                      update(
                        day,
                        list.map((x, j) => (j === idx ? { ...x, start: e.target.value } : x)),
                      )
                    }
                    className="tabular min-h-11 border border-control bg-ink-3 px-3 text-base text-text [color-scheme:dark]"
                  />
                  <span className="text-text-muted">–</span>
                  <input
                    aria-label={`${label}: til`}
                    type="time"
                    step={300}
                    value={r.end}
                    onChange={(e) =>
                      update(
                        day,
                        list.map((x, j) => (j === idx ? { ...x, end: e.target.value } : x)),
                      )
                    }
                    className="tabular min-h-11 border border-control bg-ink-3 px-3 text-base text-text [color-scheme:dark]"
                  />
                  <Button
                    variant="icon"
                    size="sm"
                    aria-label={`Fjern tidsrum ${label}`}
                    onClick={() =>
                      update(
                        day,
                        list.filter((_, j) => j !== idx),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-6">
                <Button
                  variant="ghost"
                  onClick={() =>
                    update(day, [...list, { kind: "work", start: "10:00", end: "18:00" }])
                  }
                >
                  Tilføj arbejdstid
                </Button>
                {list.some((r) => r.kind === "work") ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update(day, [...list, { kind: "break", start: "12:30", end: "13:00" }])
                    }
                  >
                    Tilføj pause
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Button onClick={save} disabled={!draft || busy} aria-busy={busy || undefined}>
          {busy ? "Gemmer …" : "Gem arbejdstider"}
        </Button>
        {draft ? (
          <Button variant="ghost" onClick={() => setDraft(null)}>
            Fortryd ændringer
          </Button>
        ) : null}
      </div>
    </section>
  );
}

// ── Ferie, fravær, blokeringer ───────────────────────────────────────────
function Exceptions({ staffId }: { staffId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const today = localDate(new Date());
  const from = zonedToUtc(today, "00:00");
  const to = zonedToUtc(addDays(today, 365), "00:00");
  const list = useExceptions(staffId, from, to);
  const bookings = useBookings(staffId, from, to);
  const weekly = useWeekly(staffId);
  const [kind, setKind] = useState<ExcKind>("vacation");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [fromTime, setFromTime] = useState("10:00");
  const [toTime, setToTime] = useState("12:00");
  const [allDay, setAllDay] = useState(true);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();

  const conflicts = useMemo(
    () =>
      bookings.data && weekly.data && list.data
        ? findConflicts(bookings.data, weekly.data as WeeklyRow[], list.data)
        : new Set<string>(),
    [bookings.data, weekly.data, list.data],
  );

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const starts = allDay ? zonedToUtc(fromDate, "00:00") : zonedToUtc(fromDate, fromTime);
    const ends = allDay ? zonedToUtc(addDays(toDate, 1), "00:00") : zonedToUtc(toDate, toTime);
    if (ends <= starts) {
      setMsg({ tone: "error", text: "Slut skal ligge efter start." });
      return;
    }
    const { error } = await supabase.from("schedule_exceptions").insert({
      staff_id: staffId,
      kind,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      note: note.trim() || null,
      created_by: me.userId,
    });
    if (error) setMsg({ tone: "error", text: `Kunne ikke gemmes: ${error.message}` });
    else {
      setMsg({ tone: "success", text: `${KIND_LABEL[kind]} er gemt.` });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["exceptions"] });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("schedule_exceptions").delete().eq("id", id);
    if (error) setMsg({ tone: "error", text: error.message });
    else await qc.invalidateQueries({ queryKey: ["exceptions"] });
  };

  const conflictList = (bookings.data ?? []).filter((b) => conflicts.has(b.id));

  return (
    <section aria-labelledby="fravaer-titel" className="grid gap-6">
      <h2 id="fravaer-titel" className="text-2xl leading-8 text-text">
        Ferie, fravær og blokeringer
      </h2>
      {conflictList.length > 0 ? (
        <Notice
          tone="error"
          title={`${conflictList.length} ${conflictList.length === 1 ? "booking er" : "bookinger er"} i konflikt med arbejdstiden.`}
        >
          <ul className="mt-2 grid gap-1">
            {conflictList.map((b) => (
              <li key={b.id}>
                <a href={`/app/booking/${b.id}`} className="underline underline-offset-4">
                  {formatWhen(new Date(b.starts_at))} · {b.customer_name}
                </a>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {msg ? <Notice tone={msg.tone} title={msg.text} live reveal /> : null}
      <form onSubmit={add} className="grid gap-4 border border-line-strong p-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ExcKind)}
            className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
          >
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base text-text">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-5 w-5 accent-[var(--color-bone)]"
          />
          Hele dage
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Fra</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
            />
            {!allDay ? (
              <input
                type="time"
                step={300}
                aria-label="Fra klokkeslæt"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="tabular min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
              />
            ) : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Til og med</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
            />
            {!allDay ? (
              <input
                type="time"
                step={300}
                aria-label="Til klokkeslæt"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="tabular min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
              />
            ) : null}
          </label>
        </div>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">
            Note <span className="font-normal text-text-muted">(valgfri)</span>
          </span>
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text"
          />
        </label>
        <Button type="submit" className="justify-self-start">
          Tilføj
        </Button>
      </form>
      {list.isPending ? (
        <Spinner />
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-text-2">Ingen planlagte undtagelser.</p>
      ) : (
        <ul className="border-y border-line">
          {list.data!.map((e, i) => (
            <li
              key={e.id}
              className={cn(
                "flex items-center justify-between gap-4 py-3",
                i > 0 && "border-t border-line",
              )}
            >
              <span className="text-sm text-text">
                <span className="mr-2 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                  {KIND_LABEL[e.kind as ExcKind]}
                </span>
                {formatDateShort(new Date(e.starts_at))} {formatTime(new Date(e.starts_at))} –{" "}
                {formatDateShort(new Date(e.ends_at))} {formatTime(new Date(e.ends_at))}
                {e.note ? <span className="block text-text-2">{e.note}</span> : null}
              </span>
              <Button
                variant="icon"
                size="sm"
                aria-label="Slet undtagelse"
                onClick={() => remove(e.id)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
