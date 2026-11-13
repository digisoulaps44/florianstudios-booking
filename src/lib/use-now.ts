import { useEffect, useState } from "react";

/** Nuværende tidspunkt, opdateret hvert minut (til "Nu"-linjen og "om 12 min"). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
