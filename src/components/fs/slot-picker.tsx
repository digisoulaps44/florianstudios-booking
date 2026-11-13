/** Tidsvælger til medarbejdere: dato + ledige tider, eller et frit klokkeslæt uden for arbejdstid. */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { dateFromDay, formatDateLong } from "@/lib/format";
import { fetchStaffSlots } from "@/lib/staff.functions";
import { isValidDateString, zonedToUtc } from "@/lib/tz";

import { TimeSlots } from "./booking";
import { CheckboxRow, Notice, Spinner } from "./primitives";

export type PickedTime = { startsAt: string; ignoreSchedule: boolean } | null;

export function StaffSlotPicker({
  staffTreatmentId,
  initialDate,
  initialTime,
  excludeBookingId,
  onChange,
}: {
  staffTreatmentId: string | undefined;
  initialDate: string;
  initialTime?: string | undefined;
  excludeBookingId?: string | undefined;
  onChange: (picked: PickedTime) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<string>();
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState(initialTime ?? "10:00");

  const slots = useQuery({
    queryKey: ["staff-slots", staffTreatmentId, date, excludeBookingId],
    queryFn: () =>
      fetchStaffSlots({
        data: {
          staffTreatmentId: staffTreatmentId!,
          date,
          ...(excludeBookingId ? { excludeBookingId } : {}),
        },
      }),
    enabled: !!staffTreatmentId && isValidDateString(date) && !manual,
  });

  useEffect(() => {
    if (manual) {
      const ok = isValidDateString(date) && /^\d{2}:\d{2}$/.test(manualTime);
      onChange(
        ok ? { startsAt: zonedToUtc(date, manualTime).toISOString(), ignoreSchedule: true } : null,
      );
    } else {
      onChange(slot ? { startsAt: slot, ignoreSchedule: false } : null);
    }
  }, [manual, manualTime, date, slot, onChange]);

  const list = slots.data?.ok ? slots.data.slots : [];

  return (
    <div className="grid gap-6">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Dato</span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSlot(undefined);
          }}
          className="min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
        />
      </label>
      {!staffTreatmentId ? (
        <p className="text-sm text-text-2">Vælg behandling først.</p>
      ) : manual ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Klokkeslæt</span>
          <input
            type="time"
            step={300}
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
            className="tabular min-h-12 border border-control bg-ink-3 px-4 text-base text-text [color-scheme:dark]"
          />
        </label>
      ) : slots.isPending ? (
        <Spinner label="Henter ledige tider …" />
      ) : list.length === 0 ? (
        <Notice
          title={`Ingen ledige tider ${isValidDateString(date) ? formatDateLong(dateFromDay(date)) : ""}.`}
        >
          Vælg en anden dato, eller book uden for arbejdstid.
        </Notice>
      ) : (
        <TimeSlots
          slots={list}
          selected={slot}
          onSelect={(s) => setSlot(s.startsAt)}
          label="Ledige tider"
        />
      )}
      <div className="border-t border-line pt-2">
        <CheckboxRow
          checked={manual}
          onChange={setManual}
          title="Book uden for arbejdstid"
          description="Vælg selv klokkeslættet. Databasen afviser stadig overlap med andre bookinger."
        />
      </div>
    </div>
  );
}
