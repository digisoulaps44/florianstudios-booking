import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarDays, Clock, X } from "lucide-react";

import { Button, Notice, Spinner } from "@/components/fs/primitives";
import { PageHeader } from "@/components/fs/staff";
import { supabase } from "@/integrations/supabase/client";
import { formatDateShort, formatTime } from "@/lib/format";
import { useNotifications, type NotificationRow } from "@/lib/staff-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/notifikationer")({ component: Notifications });

const ICON: Record<string, typeof Bell> = {
  staff_booking_confirmed: CalendarDays,
  staff_booking_changed: Clock,
  staff_booking_cancelled: X,
};

function relative(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return "Nu";
  if (diff < 60) return `${diff} min`;
  if (diff < 24 * 60) return `${Math.round(diff / 60)} t`;
  return formatDateShort(new Date(iso));
}

function Notifications() {
  const qc = useQueryClient();
  const q = useNotifications();
  const unread = (q.data ?? []).filter((n) => !n.read_at);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <>
      <PageHeader
        eyebrow="Notifikationer"
        title="Beskeder."
        actions={
          unread.length > 0 ? (
            <Button variant="ghost" onClick={() => markRead(unread.map((n) => n.id))}>
              Markér alle som læst
            </Button>
          ) : undefined
        }
      />
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <Notice tone="error" title="Notifikationerne kunne ikke hentes." />
      ) : q.data.length === 0 ? (
        <p className="border border-dashed border-line-strong p-6 text-text-2">
          Ingen notifikationer endnu. Nye bookinger vises her.
        </p>
      ) : (
        <ul aria-live="polite" className="max-w-text border-y border-line">
          {q.data.map((n, i) => (
            <Item key={n.id} n={n} first={i === 0} onOpen={() => !n.read_at && markRead([n.id])} />
          ))}
        </ul>
      )}
    </>
  );
}

function Item({ n, first, onOpen }: { n: NotificationRow; first: boolean; onOpen: () => void }) {
  const Icon = ICON[n.type] ?? Bell;
  const unread = !n.read_at;
  const body = (
    <>
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 h-5 w-5", unread ? "text-text" : "text-text-2")}
      />
      <div className="min-w-0">
        <p className={cn("text-base", unread ? "font-medium text-text" : "text-text-2")}>
          {n.title}
          {unread ? (
            <>
              <span className="ml-2 inline-block bg-bone px-1.5 align-[2px] text-[10px] leading-4 font-medium tracking-[0.15em] text-ink uppercase">
                Ny
              </span>
              <span className="sr-only">, ulæst</span>
            </>
          ) : null}
        </p>
        <p className="mt-0.5 text-sm text-text-2">{n.body}</p>
      </div>
      <span className="tabular text-xs leading-6 whitespace-nowrap text-text-muted">
        <time
          dateTime={n.created_at}
          title={`${formatDateShort(new Date(n.created_at))} ${formatTime(new Date(n.created_at))}`}
        >
          {relative(n.created_at)}
        </time>
      </span>
    </>
  );
  const cls = cn(
    "grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-4 px-3 py-4",
    !first && "border-t border-line",
    unread && "bg-bone/10",
  );
  return (
    <li>
      {n.booking_id ? (
        <Link
          to="/app/booking/$id"
          params={{ id: n.booking_id }}
          onClick={onOpen}
          className={cn(cls, "hover:bg-bone/10")}
        >
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={cn(cls, "w-full text-left")}>
          {body}
        </button>
      )}
    </li>
  );
}
