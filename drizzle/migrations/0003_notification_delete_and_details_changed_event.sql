CREATE POLICY "delete own notifications" ON public.notifications
FOR DELETE TO authenticated
USING (staff_id = public.current_staff_id());

GRANT DELETE ON public.notifications TO authenticated;

ALTER TABLE public.booking_events DROP CONSTRAINT booking_events_event_check;
ALTER TABLE public.booking_events ADD CONSTRAINT booking_events_event_check
CHECK (event IN ('created', 'rescheduled', 'cancelled', 'status_changed', 'details_changed'));