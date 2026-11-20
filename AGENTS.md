<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Booking email uses the managed sender helper with pre-rendered HTML/text and event idempotency keys; preserve the channel signature so the existing worker waits on unverified domains and never retries suppressed recipients.
- Keep server email credentials out of client defines and allow self-authenticating `/lovable/` email callbacks through request guards so dashboard previews can reach their handlers.
- Both online and staff booking creation must await booking-scoped queue dispatch after commit and link creation; preserve atomic SKIP LOCKED claims and provider job-id idempotency, and never fail a committed booking because delivery is unavailable.
- The managed half-hourly callback is the reminder/retry recovery backstop, not the trigger for new booking confirmations; keep scheduled deadlines and retry counters in the durable queue, and verify its non-secret version header with an unauthorized request before changing live scheduling.
- Resolve HTML parser dependencies through their package exports without global entities aliases or version overrides; email rendering needs multiple compatible entities majors in the same bundle.
