import { redirect } from "@tanstack/react-router";
import type { z } from "zod";

/**
 * Søgeparametre for bookingtrinnene. Mangler eller er de ugyldige (fx et gammelt
 * eller afkortet link), sendes kunden til forsiden i stedet for at få en fejlside.
 * validateSearch lader ugyldige parametre passere uændret (så URL'en ikke omskrives),
 * og beforeLoad – der kører før loaderen – sender videre til forsiden.
 */
export function bookingSearch<T extends z.ZodTypeAny>(schema: T) {
  return {
    validateSearch: (raw: Record<string, unknown>): z.output<T> => {
      const r = schema.safeParse(raw);
      return (r.success ? r.data : raw) as z.output<T>;
    },
    beforeLoad: ({ search }: { search: unknown }) => {
      if (!schema.safeParse(search).success) throw redirect({ to: "/" });
    },
  };
}
