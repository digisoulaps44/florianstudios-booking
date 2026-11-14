/**
 * Kvitteringer for handlinger med lav risiko (gem, tilføj, skjul): en toast i 4 sekunder.
 * Med en handling (fx "Fortryd") står den i 6 sekunder og pauser, mens man rører ved den.
 * Fejl vises aldrig som toast – de står ved feltet eller formularen, indtil de er løst.
 */
import { Check } from "lucide-react";
import { toast } from "sonner";

import { buttonClasses } from "@/components/fs/primitives";

type NotifyOptions = {
  description?: string | undefined;
  action?: { label: string; onClick: () => void } | undefined;
};

export function notifySuccess(title: string, opts: NotifyOptions = {}) {
  const { description, action } = opts;
  toast.custom(
    (id) => (
      <div className="glass flex w-full items-start gap-3 border border-line-strong p-4 text-text sm:w-[26rem]">
        <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-open" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-text">{title}</p>
          {description ? <p className="mt-0.5 text-sm text-text-2">{description}</p> : null}
        </div>
        {action ? (
          <button
            type="button"
            className={buttonClasses("ghost", "sm", "-my-2 shrink-0 text-text")}
            onClick={() => {
              action.onClick();
              toast.dismiss(id);
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    ),
    { duration: action ? 6000 : 4000 },
  );
}
