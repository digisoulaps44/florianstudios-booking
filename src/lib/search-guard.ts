import { redirect } from "@tanstack/react-router";
import type { z } from "zod";

const INVALID = "__ugyldig";

/**
 * Søgeparametre for bookingtrinnene. Mangler eller er de ugyldige (fx et gammelt
 * eller afkortet link), sendes kunden til forsiden i stedet for at få en fejlside.
 */
export function bookingSearch<T extends z.ZodTypeAny>(schema: T) {
  return {
    validateSearch: (raw: Record<string, unknown>): z.output<T> => {
      const r = schema.safeParse(raw);
      return (r.success ? r.data : { [INVALID]: true }) as z.output<T>;
    },
    beforeLoad: ({ search }: { search: unknown }) => {
      if (search && typeof search === "object" && INVALID in search) throw redirect({ to: "/" });
    },
  };
}
