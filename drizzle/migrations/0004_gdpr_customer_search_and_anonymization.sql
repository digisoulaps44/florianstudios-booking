CREATE FUNCTION public.search_customers(p_query text)
RETURNS TABLE (
  customer_phone text,
  customer_email text,
  customer_name text,
  booking_count bigint,
  last_booking_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  q text := btrim(p_query);
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'owner'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF q IS NULL OR length(q) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.customer_phone,
    (array_agg(b.customer_email ORDER BY b.starts_at DESC, b.created_at DESC, b.id DESC))[1],
    (array_agg(b.customer_name ORDER BY b.starts_at DESC, b.created_at DESC, b.id DESC))[1],
    count(*),
    max(b.starts_at)
  FROM public.bookings b
  WHERE b.customer_name <> 'Anonymiseret kunde'
    AND (
      b.customer_phone ILIKE '%' || q || '%'
      OR b.customer_email ILIKE '%' || q || '%'
    )
  GROUP BY b.customer_phone
  ORDER BY max(b.starts_at) DESC, b.customer_phone
  LIMIT 20;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_customers(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(text) TO authenticated;

CREATE FUNCTION public.anonymize_customer(p_phone text, p_email text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  booking_ids uuid[];
  affected_count integer;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'owner'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(m.id) INTO booking_ids
  FROM (
    SELECT b.id
    FROM public.bookings b
    WHERE b.customer_phone = p_phone
      OR (p_email IS NOT NULL AND lower(b.customer_email) = lower(p_email))
    ORDER BY b.id
    FOR UPDATE
  ) m;

  IF booking_ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.bookings b
  SET customer_name = 'Anonymiseret kunde',
      customer_phone = 'anon-' || left(b.id::text, 8),
      customer_email = NULL,
      note = NULL,
      whatsapp_opt_in = false,
      whatsapp_opt_in_at = NULL,
      updated_at = now()
  WHERE b.id = ANY(booking_ids);
  GET DIAGNOSTICS affected_count = ROW_COUNT;

  DELETE FROM public.booking_tokens t
  WHERE t.booking_id = ANY(booking_ids);

  UPDATE public.message_jobs j
  SET status = CASE
        WHEN j.status NOT IN ('sent', 'delivered', 'read')
          AND j.sent_at IS NULL
          AND j.delivered_at IS NULL
          AND j.read_at IS NULL
        THEN 'cancelled'::public.message_status
        ELSE j.status
      END,
      recipient = NULL
  WHERE j.booking_id = ANY(booking_ids)
    AND j.recipient_kind = 'customer';

  UPDATE public.booking_events e
  SET data = '{}'::jsonb
  WHERE e.booking_id = ANY(booking_ids);

  UPDATE public.notifications n
  SET body = 'Kunde anonymiseret'
  WHERE n.booking_id = ANY(booking_ids);

  DELETE FROM public.rate_limits r
  WHERE nullif(p_phone, '') IS NOT NULL
    AND strpos(r.key, p_phone) > 0;

  RETURN affected_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.anonymize_customer(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_customer(text, text) TO authenticated;