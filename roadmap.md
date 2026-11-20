# Booking message delivery

- [x] Send committed booking confirmations immediately through the existing durable worker for online and staff-created bookings; owner-requested retries also dispatch immediately.
- [x] Preserve queue claims, idempotency and retries; all 51 tests pass, and the new scoped RPC is verified against the real database without touching customer jobs.
- [ ] Publish the new dispatch before reducing managed schedule 1 (`florian_messages_every_minute`, `/api/public/cron/messages`, body `{}`) to `7,37 * * * *` (48 runs/day). Blocker: awaiting permission to publish; keep the old minute schedule until immediate live dispatch is active.
- [ ] Verify one real booking confirmation end-to-end. Blocker: awaiting an approved recipient for a clearly labelled test booking.
- [x] Preserve staff-photo access for all signed-in users, as confirmed by the owner; the broad-access security finding remains active because narrowing it would contradict this choice.