/**
 * Kundens kontaktoplysninger mellem trin 4 og 5. Gemmes kun i sessionStorage (aldrig i URL'en),
 * så de ikke deles via links eller havner i serverlogs.
 */
import { useCallback, useEffect, useState } from "react";

import type { CustomerInput } from "./booking-schemas";

const KEY = "fs-booking-customer";
const EMPTY: Required<CustomerInput> = { name: "", phone: "", email: "", whatsappOptIn: false };

function read(): Required<CustomerInput> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CustomerInput>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useCustomerDraft() {
  const [draft, setDraft] = useState<Required<CustomerInput>>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setDraft(read());
    setLoaded(true);
  }, []);
  const update = useCallback((next: Partial<CustomerInput>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(merged));
      } catch {
        /* privat tilstand – oplysningerne lever kun i hukommelsen */
      }
      return merged;
    });
  }, []);
  return { draft, update, loaded };
}

/** Én idempotensnøgle pr. valgt tid, så et genindlæst trin 5 ikke opretter en ny booking. */
export function idempotencyKeyFor(selection: string): string {
  const key = `fs-booking-idem:${selection}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearIdempotencyKey(selection: string) {
  try {
    sessionStorage.removeItem(`fs-booking-idem:${selection}`);
  } catch {
    /* ignore */
  }
}
