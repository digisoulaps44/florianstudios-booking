# Booking message delivery

- [x] Send committed booking confirmations immediately through the existing durable worker for online and staff-created bookings; owner-requested retries also dispatch immediately.
- [x] Preserve queue claims, idempotency and retries; all 52 tests pass, and the new scoped RPC is verified against the real database without touching customer jobs.
- [ ] Verify publication requested for app commit `b76f59f`, then reduce managed schedule 1 (`florian_messages_every_minute`, `/api/public/cron/messages`, body `{}`) to `7,37 * * * *` (48 runs/day). Blocker: the single safe live check after 65 seconds returned 401 without `X-Booking-Dispatch: event-v1`; deployment is not yet verified, so the minute schedule remains unchanged to protect live confirmations.
- [x] Do not create a test booking, as explicitly requested by the owner. Real confirmation delivery is not verified; automated coverage and safe live checks only.
- [x] Preserve staff-photo access for all signed-in users, as confirmed by the owner; the broad-access security finding remains active because narrowing it would contradict this choice.