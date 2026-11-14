/**
 * Én Toaster for hele appen (Sonner, monteret i roden). Selve toasten tegnes af `notify` i
 * src/lib/notify.tsx i design systemets stil – Sonner står for placering, stak, swipe og pause.
 */
import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-center"
      // Over fanebjælken på telefon (--toast-bottom følger dens højde inkl. home-indikatoren).
      offset={{ bottom: "var(--toast-bottom)" }}
      mobileOffset={{ bottom: "var(--toast-bottom)", left: "16px", right: "16px" }}
      containerAriaLabel="Beskeder"
      gap={8}
      toastOptions={{ unstyled: true }}
    />
  );
}
