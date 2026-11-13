-- Florian Studios booking – schema v1
create extension if not exists btree_gist with schema extensions;

-- ── Enums ────────────────────────────────────────────────────────────────
create type public.app_role as enum ('owner', 'staff');
create type public.booking_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type public.schedule_kind as enum ('work', 'break');
create type public.exception_kind as enum ('vacation', 'absence', 'block', 'extra_work');
create type public.message_channel as enum ('email', 'whatsapp', 'push', 'sms');
create type public.message_status as enum ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled');

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ── Salon settings (single row) ──────────────────────────────────────────
create table public.salon_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Florian Studios',
  address_line text not null default 'Toggangen 1, 2730 Herlev',
  phone text not null default '+45 71 53 07 66',
  timezone text not null default 'Europe/Copenhagen',
  cancellation_cutoff_hours int not null default 24 check (cancellation_cutoff_hours between 0 and 168),
  reminder_hours_before int not null default 24 check (reminder_hours_before between 1 and 168),
  booking_horizon_days int not null default 60 check (booking_horizon_days between 1 and 365),
  slot_interval_minutes int not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_notice_minutes int not null default 60 check (min_notice_minutes between 0 and 2880),
  updated_at timestamptz not null default now()
);
grant select, update on table public.salon_settings to authenticated;
grant all on table public.salon_settings to service_role;
create trigger salon_settings_touch before update on public.salon_settings for each row execute function public.touch_updated_at();

-- ── Roles ────────────────────────────────────────────────────────────────
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'owner')
$$;

-- ── Staff ────────────────────────────────────────────────────────────────
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  email text not null,
  phone text,
  active boolean not null default true,
  sort_order int not null default 0,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  notify_all_bookings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on table public.staff to authenticated;
grant all on table public.staff to service_role;
create unique index staff_email_lower_idx on public.staff (lower(email));
create trigger staff_touch before update on public.staff for each row execute function public.touch_updated_at();

create or replace function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() and active
$$;

-- Non-owners may only change their own profile's contact/notification fields.
create or replace function public.guard_staff_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_owner() then return new; end if;
  if new.user_id is distinct from old.user_id
     or new.email is distinct from old.email
     or new.active is distinct from old.active
     or new.sort_order is distinct from old.sort_order
     or new.notify_all_bookings is distinct from old.notify_all_bookings then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger staff_guard before update on public.staff for each row execute function public.guard_staff_update();

-- Invited staff: an owner creates a staff row with the email; when that user signs up
-- (invite link), link the account and grant the staff role. Uninvited sign-ups get nothing.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  update public.staff set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null and active
   returning id into sid;
  if sid is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'staff') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── Treatments ───────────────────────────────────────────────────────────
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on table public.treatments to authenticated;
grant all on table public.treatments to service_role;
create unique index treatments_name_lower_idx on public.treatments (lower(name));

create table public.staff_treatments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  treatment_id uuid not null references public.treatments (id) on delete restrict,
  price_ore int not null check (price_ore between 0 and 10000000),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, treatment_id)
);
grant select, insert, update, delete on table public.staff_treatments to authenticated;
grant all on table public.staff_treatments to service_role;
create trigger staff_treatments_touch before update on public.staff_treatments for each row execute function public.touch_updated_at();

-- ── Schedules ────────────────────────────────────────────────────────────
create table public.weekly_schedule (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO 8601: 1 = mandag
  kind public.schedule_kind not null default 'work',
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
grant select, insert, update, delete on table public.weekly_schedule to authenticated;
grant all on table public.weekly_schedule to service_role;
create index weekly_schedule_staff_idx on public.weekly_schedule (staff_id, weekday);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  kind public.exception_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or length(note) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
grant select, insert, update, delete on table public.schedule_exceptions to authenticated;
grant all on table public.schedule_exceptions to service_role;
create index schedule_exceptions_staff_idx on public.schedule_exceptions (staff_id, starts_at, ends_at);

-- ── Bookings ─────────────────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  staff_treatment_id uuid references public.staff_treatments (id) on delete set null,
  treatment_id uuid references public.treatments (id) on delete set null,
  treatment_name text not null,
  price_ore int not null,
  duration_minutes int not null,
  buffer_minutes int not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  status public.booking_status not null default 'confirmed',
  source text not null default 'online' check (source in ('online', 'staff')),
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  customer_phone text not null check (length(customer_phone) between 6 and 20),
  customer_email text check (customer_email is null or length(customer_email) <= 254),
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  note text check (note is null or length(note) <= 500),
  idempotency_key text unique,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by is null or cancelled_by in ('customer', 'staff', 'owner', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_until >= ends_at),
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status <> 'cancelled')
);
grant select on table public.bookings to authenticated;
grant all on table public.bookings to service_role;
create index bookings_staff_time_idx on public.bookings (staff_id, starts_at);
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event text not null check (event in ('created', 'rescheduled', 'cancelled', 'status_changed')),
  actor text not null check (actor in ('customer', 'staff', 'owner', 'system')),
  actor_user_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on table public.booking_events to authenticated;
grant all on table public.booking_events to service_role;
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

create table public.booking_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on table public.booking_tokens to service_role;

-- ── Messages and notifications ───────────────────────────────────────────
create table public.message_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  channel public.message_channel not null,
  template text not null,
  recipient_kind text not null check (recipient_kind in ('customer', 'staff')),
  recipient_staff_id uuid references public.staff (id) on delete cascade,
  recipient text,
  scheduled_for timestamptz not null default now(),
  status public.message_status not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  provider_message_id text,
  dedupe_key text not null unique,
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on table public.message_jobs to authenticated;
grant all on table public.message_jobs to service_role;
create index message_jobs_due_idx on public.message_jobs (status, scheduled_for);
create index message_jobs_provider_idx on public.message_jobs (provider_message_id) where provider_message_id is not null;
create trigger message_jobs_touch before update on public.message_jobs for each row execute function public.touch_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;
create index notifications_staff_idx on public.notifications (staff_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  expired_at timestamptz
);
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
grant all on table public.rate_limits to service_role;

-- ── Server-only functions ────────────────────────────────────────────────
-- Fixed-window rate limit. Returns true when the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n <= p_limit;
end $$;

-- Writes message jobs and staff notifications for one booking event (same transaction as the change).
create or replace function public.enqueue_booking_messages(p_booking_id uuid, p_event_id uuid, p_event text, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.salon_settings;
  st public.staff;
  tmpl text;
  remind_at timestamptz;
  local_when text;
  rec record;
begin
  select * into b from public.bookings where id = p_booking_id;
  select * into s from public.salon_settings where id = 1;
  select * into st from public.staff where id = b.staff_id;
  tmpl := case p_event when 'created' then 'booking_confirmed' when 'rescheduled' then 'booking_changed' when 'cancelled' then 'booking_cancelled' end;
  if tmpl is null then return; end if;
  local_when := to_char(b.starts_at at time zone s.timezone, 'DD.MM.YYYY "kl." HH24:MI');

  -- Customer: mail always (when an address exists), WhatsApp only with opt-in.
  if b.customer_email is not null then
    insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient, dedupe_key)
    values (b.id, 'email', tmpl, 'customer', b.customer_email, p_event_id || ':email:' || tmpl)
    on conflict (dedupe_key) do nothing;
  end if;
  if b.whatsapp_opt_in then
    insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient, dedupe_key)
    values (b.id, 'whatsapp', tmpl, 'customer', b.customer_phone, p_event_id || ':whatsapp:' || tmpl)
    on conflict (dedupe_key) do nothing;
  end if;

  -- Staff: the booking's staff member always gets an in-app notification for customer actions;
  -- owners who opted in to all bookings get one too. Mail/push follow each person's settings.
  if p_actor = 'customer' then
    for rec in
      select x.* from public.staff x
       where x.active and (x.id = b.staff_id
          or (x.notify_all_bookings and x.user_id is not null and public.has_role(x.user_id, 'owner')))
    loop
      insert into public.notifications (staff_id, booking_id, type, title, body)
      values (rec.id, b.id, 'staff_' || tmpl,
              case p_event when 'created' then 'Ny booking' when 'rescheduled' then 'Booking flyttet' else 'Booking aflyst' end,
              b.customer_name || ' · ' || b.treatment_name || ' · ' || local_when ||
              case when rec.id <> b.staff_id then ' · ' || st.display_name else '' end);
      if rec.notify_email then
        insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient_staff_id, recipient, dedupe_key)
        values (b.id, 'email', 'staff_' || tmpl, 'staff', rec.id, rec.email, p_event_id || ':email:staff:' || rec.id)
        on conflict (dedupe_key) do nothing;
      end if;
      if rec.notify_push then
        insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient_staff_id, dedupe_key)
        values (b.id, 'push', 'staff_' || tmpl, 'staff', rec.id, p_event_id || ':push:staff:' || rec.id)
        on conflict (dedupe_key) do nothing;
      end if;
    end loop;
  end if;

  -- Reminders: drop pending ones, schedule new ones only if they are still in the future.
  update public.message_jobs set status = 'cancelled'
   where booking_id = b.id and template = 'booking_reminder' and status in ('pending', 'processing');
  if b.status = 'confirmed' then
    remind_at := b.starts_at - make_interval(hours => s.reminder_hours_before);
    if remind_at > now() + interval '15 minutes' then
      if b.customer_email is not null then
        insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient, scheduled_for, dedupe_key)
        values (b.id, 'email', 'booking_reminder', 'customer', b.customer_email, remind_at,
                b.id || ':reminder:email:' || extract(epoch from b.starts_at)::bigint)
        on conflict (dedupe_key) do update set status = 'pending', scheduled_for = excluded.scheduled_for, attempts = 0;
      end if;
      if b.whatsapp_opt_in then
        insert into public.message_jobs (booking_id, channel, template, recipient_kind, recipient, scheduled_for, dedupe_key)
        values (b.id, 'whatsapp', 'booking_reminder', 'customer', b.customer_phone, remind_at,
                b.id || ':reminder:whatsapp:' || extract(epoch from b.starts_at)::bigint)
        on conflict (dedupe_key) do update set status = 'pending', scheduled_for = excluded.scheduled_for, attempts = 0;
      end if;
    end if;
  end if;
end $$;

-- Atomic create. Overlaps raise SQLSTATE 23P01 (bookings_no_overlap). Repeating the same
-- idempotency key returns the existing booking instead of creating a duplicate.
create or replace function public.create_booking(
  p_staff_treatment_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_whatsapp_opt_in boolean,
  p_note text,
  p_source text,
  p_idempotency_key text,
  p_token_hash text,
  p_token_expires_at timestamptz,
  p_actor text,
  p_actor_user_id uuid
) returns table (booking_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  t record;
  b_id uuid;
  ev_id uuid;
begin
  if p_idempotency_key is not null then
    select id into b_id from public.bookings where idempotency_key = p_idempotency_key;
    if found then return query select b_id, false; return; end if;
  end if;

  select x.*, tr.name as treatment_name, sf.active as staff_active, tr.active as treatment_active
    into t
    from public.staff_treatments x
    join public.treatments tr on tr.id = x.treatment_id
    join public.staff sf on sf.id = x.staff_id
   where x.id = p_staff_treatment_id;
  if not found or not t.active or not t.staff_active or not t.treatment_active then
    raise exception 'treatment_unavailable' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    staff_id, staff_treatment_id, treatment_id, treatment_name, price_ore, duration_minutes, buffer_minutes,
    starts_at, ends_at, blocked_until, source, customer_name, customer_phone, customer_email,
    whatsapp_opt_in, whatsapp_opt_in_at, note, idempotency_key)
  values (
    t.staff_id, t.id, t.treatment_id, t.treatment_name, t.price_ore, t.duration_minutes, t.buffer_minutes,
    p_starts_at, p_starts_at + make_interval(mins => t.duration_minutes),
    p_starts_at + make_interval(mins => t.duration_minutes + t.buffer_minutes),
    p_source, trim(p_customer_name), p_customer_phone, nullif(trim(coalesce(p_customer_email, '')), ''),
    coalesce(p_whatsapp_opt_in, false), case when p_whatsapp_opt_in then now() end, p_note, p_idempotency_key)
  returning id into b_id;

  if p_token_hash is not null then
    insert into public.booking_tokens (booking_id, token_hash, expires_at) values (b_id, p_token_hash, p_token_expires_at);
  end if;

  insert into public.booking_events (booking_id, event, actor, actor_user_id, data)
  values (b_id, 'created', p_actor, p_actor_user_id, jsonb_build_object('starts_at', p_starts_at))
  returning id into ev_id;

  perform public.enqueue_booking_messages(b_id, ev_id, 'created', p_actor);
  return query select b_id, true;
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select id into b_id from public.bookings where idempotency_key = p_idempotency_key;
      if found then return query select b_id, false; return; end if;
    end if;
    raise;
end $$;

-- Atomic move: one UPDATE, so a conflict (23P01) leaves the original booking untouched.
-- Customers are held to the salon's cancellation cutoff here, in the database.
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_new_starts_at timestamptz,
  p_new_staff_treatment_id uuid,
  p_actor text,
  p_actor_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  t record;
  s public.salon_settings;
  ev_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.status <> 'confirmed' then raise exception 'booking_not_active' using errcode = 'P0001'; end if;
  select * into s from public.salon_settings where id = 1;
  if p_actor = 'customer' and now() > b.starts_at - make_interval(hours => s.cancellation_cutoff_hours) then
    raise exception 'cutoff_passed' using errcode = 'P0001';
  end if;

  if p_new_staff_treatment_id is not null and p_new_staff_treatment_id is distinct from b.staff_treatment_id then
    select x.*, tr.name as treatment_name, sf.active as staff_active
      into t
      from public.staff_treatments x
      join public.treatments tr on tr.id = x.treatment_id
      join public.staff sf on sf.id = x.staff_id
     where x.id = p_new_staff_treatment_id;
    if not found or not t.active or not t.staff_active then
      raise exception 'treatment_unavailable' using errcode = 'P0001';
    end if;
    update public.bookings set
      staff_id = t.staff_id, staff_treatment_id = t.id, treatment_id = t.treatment_id,
      treatment_name = t.treatment_name, price_ore = t.price_ore,
      duration_minutes = t.duration_minutes, buffer_minutes = t.buffer_minutes,
      starts_at = p_new_starts_at,
      ends_at = p_new_starts_at + make_interval(mins => t.duration_minutes),
      blocked_until = p_new_starts_at + make_interval(mins => t.duration_minutes + t.buffer_minutes)
    where id = b.id;
  else
    -- Keep the price and duration that were agreed when the booking was made.
    update public.bookings set
      starts_at = p_new_starts_at,
      ends_at = p_new_starts_at + make_interval(mins => b.duration_minutes),
      blocked_until = p_new_starts_at + make_interval(mins => b.duration_minutes + b.buffer_minutes)
    where id = b.id;
  end if;

  insert into public.booking_events (booking_id, event, actor, actor_user_id, data)
  values (b.id, 'rescheduled', p_actor, p_actor_user_id,
          jsonb_build_object('from', b.starts_at, 'to', p_new_starts_at, 'from_staff_id', b.staff_id))
  returning id into ev_id;

  perform public.enqueue_booking_messages(b.id, ev_id, 'rescheduled', p_actor);
end $$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_actor text,
  p_actor_user_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.salon_settings;
  ev_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.status = 'cancelled' then return; end if; -- idempotent
  if b.status <> 'confirmed' then raise exception 'booking_not_active' using errcode = 'P0001'; end if;
  select * into s from public.salon_settings where id = 1;
  if p_actor = 'customer' and now() > b.starts_at - make_interval(hours => s.cancellation_cutoff_hours) then
    raise exception 'cutoff_passed' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor where id = b.id;
  update public.booking_tokens set revoked_at = now() where booking_id = b.id and revoked_at is null;

  insert into public.booking_events (booking_id, event, actor, actor_user_id, data)
  values (b.id, 'cancelled', p_actor, p_actor_user_id, jsonb_build_object('reason', p_reason))
  returning id into ev_id;

  perform public.enqueue_booking_messages(b.id, ev_id, 'cancelled', p_actor);
end $$;

create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_actor text,
  p_actor_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if p_status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.status = 'cancelled' then raise exception 'booking_not_active' using errcode = 'P0001'; end if;
  if b.status = p_status then return; end if;
  update public.bookings set status = p_status where id = b.id;
  if p_status <> 'confirmed' then
    update public.message_jobs set status = 'cancelled'
     where booking_id = b.id and template = 'booking_reminder' and status in ('pending', 'processing');
  end if;
  insert into public.booking_events (booking_id, event, actor, actor_user_id, data)
  values (b.id, 'status_changed', p_actor, p_actor_user_id, jsonb_build_object('from', b.status, 'to', p_status));
end $$;

-- Queue worker: claim due jobs (and jobs stuck in processing > 10 min) without double-claiming.
create or replace function public.claim_message_jobs(p_limit int) returns setof public.message_jobs
language sql security definer set search_path = public as $$
  update public.message_jobs j
     set status = 'processing', locked_at = now(), attempts = j.attempts + 1
   where j.id in (
     select id from public.message_jobs
      where ((status = 'pending' and scheduled_for <= now())
          or (status = 'processing' and locked_at < now() - interval '10 minutes'))
        and attempts < max_attempts
      order by scheduled_for
      limit p_limit
      for update skip locked)
  returning j.*;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.enqueue_booking_messages(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, timestamptz, text, text, text, boolean, text, text, text, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, timestamptz, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.set_booking_status(uuid, public.booking_status, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_message_jobs(int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
grant execute on function public.enqueue_booking_messages(uuid, uuid, text, text) to service_role;
grant execute on function public.create_booking(uuid, timestamptz, text, text, text, boolean, text, text, text, text, timestamptz, text, uuid) to service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz, uuid, text, uuid) to service_role;
grant execute on function public.cancel_booking(uuid, text, uuid, text) to service_role;
grant execute on function public.set_booking_status(uuid, public.booking_status, text, uuid) to service_role;
grant execute on function public.claim_message_jobs(int) to service_role;

-- ── Row level security ───────────────────────────────────────────────────
alter table public.salon_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff enable row level security;
alter table public.treatments enable row level security;
alter table public.staff_treatments enable row level security;
alter table public.weekly_schedule enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_tokens enable row level security;
alter table public.message_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_limits enable row level security;
-- No anon policies anywhere: public pages read through server functions only.

create policy "staff read settings" on public.salon_settings for select to authenticated using (public.current_staff_id() is not null);
create policy "owner updates settings" on public.salon_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_owner());
create policy "owner manages roles" on public.user_roles for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "staff read staff" on public.staff for select to authenticated using (public.current_staff_id() is not null or public.is_owner());
create policy "update own profile or owner" on public.staff for update to authenticated
  using (user_id = auth.uid() or public.is_owner()) with check (user_id = auth.uid() or public.is_owner());
create policy "owner inserts staff" on public.staff for insert to authenticated with check (public.is_owner());
create policy "owner deletes staff" on public.staff for delete to authenticated using (public.is_owner());

create policy "staff read treatments" on public.treatments for select to authenticated using (public.current_staff_id() is not null or public.is_owner());
create policy "staff create treatments" on public.treatments for insert to authenticated with check (public.current_staff_id() is not null or public.is_owner());
create policy "owner updates treatments" on public.treatments for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner deletes treatments" on public.treatments for delete to authenticated using (public.is_owner());

create policy "staff read staff treatments" on public.staff_treatments for select to authenticated using (public.current_staff_id() is not null or public.is_owner());
create policy "own staff treatments" on public.staff_treatments for all to authenticated
  using (staff_id = public.current_staff_id() or public.is_owner())
  with check (staff_id = public.current_staff_id() or public.is_owner());

create policy "own weekly schedule" on public.weekly_schedule for all to authenticated
  using (staff_id = public.current_staff_id() or public.is_owner())
  with check (staff_id = public.current_staff_id() or public.is_owner());

create policy "own exceptions" on public.schedule_exceptions for all to authenticated
  using (staff_id = public.current_staff_id() or public.is_owner())
  with check (staff_id = public.current_staff_id() or public.is_owner());

-- Bookings are written only through the server-only functions above.
create policy "read own bookings" on public.bookings for select to authenticated
  using (staff_id = public.current_staff_id() or public.is_owner());
create policy "read own booking events" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and (b.staff_id = public.current_staff_id() or public.is_owner())));

create policy "owner reads message jobs" on public.message_jobs for select to authenticated using (public.is_owner());

create policy "own notifications" on public.notifications for select to authenticated using (staff_id = public.current_staff_id());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (staff_id = public.current_staff_id()) with check (staff_id = public.current_staff_id());

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- booking_tokens and rate_limits: no policies (server only).

-- ── Realtime for the staff calendar and notification center ─────────────
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.notifications;
