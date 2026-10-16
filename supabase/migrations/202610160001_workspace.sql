-- One establishment per Supabase project. Auth accounts are provisioned separately.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;

create table public.employees (
  id text primary key check (length(id) between 1 and 100),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  email text not null check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email) <= 254),
  phone text not null default '' check (length(phone) <= 50),
  position text not null check (length(trim(position)) between 1 and 150),
  department text not null check (length(trim(department)) between 1 and 100),
  contract_type text not null check (contract_type in ('CDI', 'CDD', 'Alternance', 'Stage')),
  start_date date not null,
  end_date date check (end_date >= start_date),
  hourly_rate numeric(10,2) not null check (hourly_rate between 0 and 100000),
  monthly_hours numeric(6,2) not null check (monthly_hours between 0 and 744),
  social_security_number text not null default '' check (length(social_security_number) <= 50),
  address text not null default '' check (length(address) <= 500),
  postal_code text not null default '' check (length(postal_code) <= 20),
  city text not null default '' check (length(city) <= 150),
  bank_rib text not null default '' check (length(bank_rib) <= 100),
  role text not null default 'employee' check (role in ('admin', 'employee')),
  active boolean not null default true,
  night_work boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table public.shifts (
  id text primary key check (length(id) between 1 and 100),
  employee_id text not null references public.employees(id) on delete restrict,
  date date not null,
  start_time time not null check (extract(second from start_time) = 0 and start_time < time '24:00'),
  end_time time not null check (extract(second from end_time) = 0 and end_time < time '24:00'),
  role text not null check (length(trim(role)) between 1 and 150),
  notes text not null default '' check (length(notes) <= 4000),
  is_night_shift boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'present', 'absence_justified', 'absence_unjustified')),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  check (start_time <> end_time),
  -- Venue civil time, independent of the browser/server timezone. End is exclusive.
  slot tsrange generated always as (
    tsrange(date + start_time, date + end_time + case when end_time < start_time then interval '1 day' else interval '0' end, '[)')
  ) stored,
  constraint shifts_no_overlap exclude using gist (employee_id with =, slot with &&)
);
create index shifts_date_idx on public.shifts(date);

-- Receipts contain no employee fields. They make a retry after a lost response safe.
create table private.mutation_receipts (
  request_id uuid primary key,
  actor uuid not null,
  payload_hash text not null,
  created_at timestamptz not null default now()
);
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- These helpers deliberately bypass RLS to avoid recursive policies. They accept
-- no user-controlled identity or role and always resolve the signed-in auth.uid().
create function private.current_employee_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.employees where auth_user_id = (select auth.uid()) and active;
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.employees where auth_user_id = (select auth.uid()) and active and role = 'admin');
$$;
revoke all on function private.current_employee_id(), private.is_admin() from public, anon, authenticated;
grant execute on function private.current_employee_id(), private.is_admin() to authenticated;

alter table public.employees enable row level security;
alter table public.shifts enable row level security;
revoke all on public.employees, public.shifts from public, anon, authenticated;
grant select on public.employees, public.shifts to authenticated;
create policy employees_read on public.employees for select to authenticated
  using ((select private.is_admin()) or id = (select private.current_employee_id()));
create policy shifts_read on public.shifts for select to authenticated
  using ((select private.is_admin()) or employee_id = (select private.current_employee_id()));

-- One consistent snapshot; invoker rights retain RLS even on direct RPC calls.
create function public.workspace_snapshot() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare member_id text := private.current_employee_id();
begin
  if member_id is null then raise exception using errcode = '42501', message = 'workspace_access_denied'; end if;
  return jsonb_build_object(
    'current_employee_id', member_id,
    'employees', coalesce((select jsonb_agg((to_jsonb(e) - 'auth_user_id') || jsonb_build_object('access_linked', e.auth_user_id is not null) order by e.last_name, e.id) from public.employees e), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(to_jsonb(s) - 'slot' order by s.date, s.start_time, s.id) from public.shifts s), '[]'::jsonb)
  );
end;
$$;

-- Only this function can mutate business data through the API. Each batch is
-- atomic; optimistic revisions protect stale forms, including stale deletions.
create function public.apply_workspace_changes(
  p_request_id uuid,
  p_employee_changes jsonb default '[]',
  p_shift_changes jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  change jsonb; data jsonb; record_id text; expected integer;
  old_employee public.employees; new_employee public.employees;
  new_shift public.shifts; old_shift public.shifts;
  receipt private.mutation_receipts;
  payload_hash text := md5(p_employee_changes::text || ':' || p_shift_changes::text);
begin
  -- Serializes permission changes with business mutations for this establishment.
  perform pg_advisory_xact_lock(162016001);
  if not private.is_admin() then raise exception using errcode = '42501', message = 'workspace_admin_required'; end if;
  if p_request_id is null or p_employee_changes is null or p_shift_changes is null
    or jsonb_typeof(p_employee_changes) <> 'array' or jsonb_typeof(p_shift_changes) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_changes';
  end if;
  if jsonb_array_length(p_employee_changes) + jsonb_array_length(p_shift_changes) > 500 then
    raise exception using errcode = '22023', message = 'batch_too_large';
  end if;
  select * into receipt from private.mutation_receipts where request_id = p_request_id;
  if found then
    if receipt.actor <> auth.uid() or receipt.payload_hash <> payload_hash then
      raise exception using errcode = '22023', message = 'request_id_reused';
    end if;
    return public.workspace_snapshot();
  end if;

  for change in select value from jsonb_array_elements(p_employee_changes) loop
    data := change->'data'; record_id := coalesce(data->>'id', change->>'id');
    expected := (change->>'expected_revision')::integer;
    select * into old_employee from public.employees where id = record_id;
    if (expected is null and found) or (expected is not null and (not found or old_employee.revision <> expected)) then
      raise exception using errcode = '40001', message = 'stale_record';
    end if;
    if change->>'kind' = 'delete' then
      if expected is null then raise exception using errcode = '22023', message = 'revision_required'; end if;
      if old_employee.auth_user_id = auth.uid() then raise exception using errcode = '42501', message = 'cannot_remove_own_access'; end if;
      delete from public.employees where id = record_id;
    elsif change->>'kind' = 'save' and jsonb_typeof(data) = 'object' then
      if data - array['id','first_name','last_name','email','phone','position','department','contract_type','start_date','end_date','hourly_rate','monthly_hours','social_security_number','address','postal_code','city','bank_rib','role','active','night_work'] <> '{}'::jsonb then
        raise exception using errcode = '22023', message = 'unsupported_employee_field';
      end if;
      new_employee := jsonb_populate_record(null::public.employees, data);
      if old_employee.auth_user_id = auth.uid() and (new_employee.role <> 'admin' or not new_employee.active) then
        raise exception using errcode = '42501', message = 'cannot_remove_own_access';
      end if;
      if old_employee.auth_user_id is not null and new_employee.email is distinct from old_employee.email then
        raise exception using errcode = '22023', message = 'linked_email_change';
      end if;
      if expected is null then
        insert into public.employees (id, first_name, last_name, email, phone, position, department, contract_type, start_date, end_date, hourly_rate, monthly_hours, social_security_number, address, postal_code, city, bank_rib, role, active, night_work)
        values (new_employee.id, new_employee.first_name, new_employee.last_name, new_employee.email, new_employee.phone, new_employee.position, new_employee.department, new_employee.contract_type, new_employee.start_date, new_employee.end_date, new_employee.hourly_rate, new_employee.monthly_hours, new_employee.social_security_number, new_employee.address, new_employee.postal_code, new_employee.city, new_employee.bank_rib, new_employee.role, new_employee.active, new_employee.night_work);
      else
        update public.employees set first_name = new_employee.first_name, last_name = new_employee.last_name, email = new_employee.email, phone = new_employee.phone, position = new_employee.position, department = new_employee.department, contract_type = new_employee.contract_type, start_date = new_employee.start_date, end_date = new_employee.end_date, hourly_rate = new_employee.hourly_rate, monthly_hours = new_employee.monthly_hours, social_security_number = new_employee.social_security_number, address = new_employee.address, postal_code = new_employee.postal_code, city = new_employee.city, bank_rib = new_employee.bank_rib, role = new_employee.role, active = new_employee.active, night_work = new_employee.night_work, revision = revision + 1, updated_at = now()
        where id = record_id;
      end if;
    else raise exception using errcode = '22023', message = 'invalid_employee_change'; end if;
  end loop;

  for change in select value from jsonb_array_elements(p_shift_changes) loop
    data := change->'data'; record_id := coalesce(data->>'id', change->>'id');
    expected := (change->>'expected_revision')::integer;
    select * into old_shift from public.shifts where id = record_id;
    if (expected is null and found) or (expected is not null and (not found or old_shift.revision <> expected)) then
      raise exception using errcode = '40001', message = 'stale_record';
    end if;
    if change->>'kind' = 'delete' then
      if expected is null then raise exception using errcode = '22023', message = 'revision_required'; end if;
      delete from public.shifts where id = record_id;
    elsif change->>'kind' = 'save' and jsonb_typeof(data) = 'object' then
      if data - array['id','employee_id','date','start_time','end_time','role','notes','is_night_shift','status'] <> '{}'::jsonb then
        raise exception using errcode = '22023', message = 'unsupported_shift_field';
      end if;
      new_shift := jsonb_populate_record(null::public.shifts, data);
      -- Keep historical attendance/notes editable after archiving, but no new assignment.
      if (expected is null or (old_shift.employee_id, old_shift.date, old_shift.start_time, old_shift.end_time) is distinct from (new_shift.employee_id, new_shift.date, new_shift.start_time, new_shift.end_time))
        and not exists(select 1 from public.employees where id = new_shift.employee_id and active) then
        raise exception using errcode = '23514', message = 'inactive_employee';
      end if;
      if expected is null then
        insert into public.shifts (id, employee_id, date, start_time, end_time, role, notes, is_night_shift, status)
        values (new_shift.id, new_shift.employee_id, new_shift.date, new_shift.start_time, new_shift.end_time, new_shift.role, new_shift.notes, new_shift.is_night_shift, new_shift.status);
      else
        update public.shifts set employee_id = new_shift.employee_id, date = new_shift.date, start_time = new_shift.start_time, end_time = new_shift.end_time, role = new_shift.role, notes = new_shift.notes, is_night_shift = new_shift.is_night_shift, status = new_shift.status, revision = revision + 1, updated_at = now() where id = record_id;
      end if;
    else raise exception using errcode = '22023', message = 'invalid_shift_change'; end if;
  end loop;
  insert into private.mutation_receipts(request_id, actor, payload_hash) values (p_request_id, auth.uid(), payload_hash);
  return public.workspace_snapshot();
end;
$$;
revoke all on function public.workspace_snapshot(), public.apply_workspace_changes(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.workspace_snapshot(), public.apply_workspace_changes(uuid, jsonb, jsonb) to authenticated;

-- Operator-only setup. These functions are not exposed to browser/API roles.
create function private.bootstrap_admin(p_auth_user_id uuid, p_first_name text, p_last_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare new_id text := gen_random_uuid()::text; account_email text;
begin
  perform pg_advisory_xact_lock(162016001);
  if exists(select 1 from public.employees) then raise exception 'workspace_already_initialized'; end if;
  select lower(email) into strict account_email from auth.users where id = p_auth_user_id and email_confirmed_at is not null;
  insert into public.employees(id, auth_user_id, first_name, last_name, email, position, department, contract_type, start_date, hourly_rate, monthly_hours, role)
  values (new_id, p_auth_user_id, p_first_name, p_last_name, account_email, 'Responsable', 'Direction', 'CDI', current_date, 0, 0, 'admin');
  return new_id;
end;
$$;
create function private.link_employee_account(p_employee_id text, p_auth_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(162016001);
  if not exists(select 1 from public.employees e join auth.users u on lower(u.email) = e.email where e.id = p_employee_id and e.active and u.id = p_auth_user_id and u.email_confirmed_at is not null) then
    raise exception 'confirmed_account_email_must_match_active_employee';
  end if;
  update public.employees set auth_user_id = p_auth_user_id, revision = revision + 1, updated_at = now() where id = p_employee_id;
end;
$$;
revoke all on function private.bootstrap_admin(uuid, text, text), private.link_employee_account(text, uuid) from public, anon, authenticated, service_role;
reset search_path;
