CREATE FUNCTION public.claim_booking_message_jobs(p_booking_id uuid, p_limit integer)
RETURNS SETOF public.message_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.message_jobs j
     SET status = 'processing', locked_at = now(), attempts = j.attempts + 1
   WHERE j.id IN (
     SELECT id FROM public.message_jobs
      WHERE booking_id = p_booking_id
        AND ((status = 'pending' AND scheduled_for <= now())
          OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
        AND attempts < max_attempts
      ORDER BY scheduled_for, id
      LIMIT greatest(0, least(p_limit, 20))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_message_jobs(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_message_jobs(uuid, integer) TO service_role;