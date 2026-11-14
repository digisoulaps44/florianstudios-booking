import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button, Monogram } from "@/components/fs/primitives";
import { notifySuccess } from "@/lib/notify";
import { removeStaffPhoto, uploadStaffPhoto, useStaffPhotoUrl } from "@/lib/staff-photo";

/** Vælg, erstat eller fjern profilfoto. Beskæres kvadratisk og komprimeres før upload. */
export function StaffPhotoEditor({
  staffId,
  name,
  photoPath,
  onError,
}: {
  staffId: string;
  name: string;
  photoPath: string | null;
  onError: (text: string) => void;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = useStaffPhotoUrl(photoPath);

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      notifySuccess(ok);
    } catch {
      onError(fail);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      await qc.invalidateQueries({ queryKey: ["staff"] });
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onError("Vælg et billede (JPEG, PNG eller HEIC).");
    void run(
      () => uploadStaffPhoto(staffId, file, photoPath),
      "Billedet er gemt",
      "Billedet kunne ikke gemmes. Prøv et andet billede.",
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Monogram name={name} src={src} className="h-20 w-20 text-2xl" />
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          onClick={() => input.current?.click()}
        >
          {busy ? "Gemmer …" : photoPath ? "Skift billede" : "Vælg billede"}
        </Button>
        {photoPath ? (
          <Button
            size="sm"
            variant="ghost"
            aria-disabled={busy || undefined}
            onClick={() =>
              run(
                () => removeStaffPhoto(staffId, photoPath),
                "Billedet er fjernet",
                "Billedet kunne ikke fjernes. Prøv igen.",
              )
            }
          >
            Fjern billede
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Monogram med medarbejderens foto (signeret URL), ellers initialer. */
export function StaffAvatar({ name, photoPath }: { name: string; photoPath: string | null }) {
  return <Monogram name={name} src={useStaffPhotoUrl(photoPath)} />;
}
