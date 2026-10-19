-- Upgrade the existing installation in place. Login accounts and restaurant
-- memberships are independent of payroll employee records.
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.employees add column restaurant_id uuid references public.restaurants(id);
alter table public.shifts add column restaurant_id uuid references public.restaurants(id);

-- Preserve an existing single-venue installation, including every employee/shift.
do $$
declare venue uuid;
begin
  if exists(select 1 from public.employees) then
    insert into public.restaurants(name) values ('Mon établissement') returning id into venue;
    update public.employees set restaurant_id = venue;
    update public.shifts set restaurant_id = venue;
  end if;
end $$;
alter table public.employees alter column restaurant_id set not null;
alter table public.shifts alter column restaurant_id set not null;
alter table public.shifts drop constraint shifts_employee_id_fkey;
alter table public.shifts drop constraint shifts_no_overlap;
alter table public.employees drop constraint employees_pkey;
alter table public.employees add primary key (restaurant_id, id);
alter table public.employees drop constraint employees_email_key;
alter table public.employees add unique (restaurant_id, email);
alter table public.shifts drop constraint shifts_pkey;
alter table public.shifts add primary key (restaurant_id, id);
alter table public.shifts add foreign key (restaurant_id, employee_id) references public.employees(restaurant_id, id) on delete restrict;
set search_path = public, extensions;
alter table public.shifts add constraint shifts_no_overlap exclude using gist (restaurant_id with =, employee_id with =, slot with &&);
reset search_path;

create table public.memberships (
  restaurant_id uuid not null references public.restaurants(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','employee')),
  employee_id text,
  active boolean not null default true,
  revision integer not null default 1,
  primary key (restaurant_id, user_id),
  unique (restaurant_id, employee_id),
  foreign key (restaurant_id, employee_id) references public.employees(restaurant_id, id) on delete restrict,
  check (role <> 'employee' or employee_id is not null)
);
-- Legacy administrators become owners; their staff record remains a staff record.
insert into public.memberships(restaurant_id, user_id, role, employee_id, active)
select restaurant_id, auth_user_id, case when role = 'admin' then 'owner' else 'employee' end,
  case when role = 'admin' then null else id end, active
from public.employees where auth_user_id is not null;

-- Remove every legacy authorization path before removing its old account column.
drop function public.apply_workspace_changes(uuid,jsonb,jsonb);
drop function public.workspace_snapshot();
drop function private.bootstrap_admin(uuid,text,text);
drop function private.link_employee_account(text,uuid);
drop policy employees_read on public.employees;
drop policy shifts_read on public.shifts;
drop function private.current_employee_id();
drop function private.is_admin();
alter table public.employees drop column auth_user_id;
update public.employees set role = 'employee';

create table private.invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  email text not null,
  role text not null check (role in ('admin','employee')),
  employee_id text,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  foreign key (restaurant_id,employee_id) references public.employees(restaurant_id,id) on delete cascade,
  check ((role = 'employee' and employee_id is not null) or (role = 'admin' and employee_id is null))
);
revoke all on private.invitations from public, anon, authenticated;

create function private.lock_restaurant(venue uuid) returns void
language sql set search_path = '' as $$ select pg_advisory_xact_lock(hashtextextended(venue::text, 162016001)); $$;
create function private.restaurant_role(venue uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m join auth.users u on u.id = m.user_id
  where m.restaurant_id = venue and m.user_id = auth.uid() and m.active and u.email_confirmed_at is not null
    and (m.role = 'owner' or m.employee_id is null or exists(select 1 from public.employees e where e.restaurant_id = venue and e.id = m.employee_id and e.active and e.email = lower(u.email)));
$$;
create function private.restaurant_employee(venue uuid) returns text
language sql stable security definer set search_path = '' as $$
  select employee_id from public.memberships where restaurant_id = venue and user_id = auth.uid() and private.restaurant_role(venue) is not null;
$$;
revoke all on function private.lock_restaurant(uuid), private.restaurant_role(uuid), private.restaurant_employee(uuid) from public, anon, authenticated;
grant execute on function private.restaurant_role(uuid), private.restaurant_employee(uuid) to authenticated;
alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
revoke all on public.restaurants, public.memberships from public, anon, authenticated;
grant select on public.restaurants, public.memberships to authenticated;
create policy restaurant_read on public.restaurants for select to authenticated using (private.restaurant_role(id) is not null);
create policy membership_read on public.memberships for select to authenticated using (private.restaurant_role(restaurant_id) = 'owner' or (user_id = auth.uid() and private.restaurant_role(restaurant_id) is not null));
create policy employees_read on public.employees for select to authenticated using (private.restaurant_role(restaurant_id) in ('owner','admin') or id = private.restaurant_employee(restaurant_id));
create policy shifts_read on public.shifts for select to authenticated using (private.restaurant_role(restaurant_id) in ('owner','admin') or employee_id = private.restaurant_employee(restaurant_id));

create function public.workspace_snapshot(p_restaurant_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare account auth.users; venues jsonb; venue uuid; access_role text; staff text;
begin
  select * into account from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if not found then raise exception using errcode = '42501', message = 'confirmed_account_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'role', private.restaurant_role(r.id)) order by r.created_at,r.id),'[]') into venues
  from public.restaurants r where private.restaurant_role(r.id) is not null;
  venue := coalesce(p_restaurant_id, (venues->0->>'id')::uuid);
  access_role := private.restaurant_role(venue);
  if venue is not null and access_role is null then raise exception using errcode = '42501', message = 'restaurant_access_denied'; end if;
  staff := private.restaurant_employee(venue);
  return jsonb_build_object(
    'account', jsonb_build_object('id',account.id,'email',account.email,'name',coalesce(nullif(account.raw_user_meta_data->>'full_name',''),split_part(account.email,'@',1))),
    'restaurants',venues,'restaurant_id',venue,'membership_role',access_role,'current_employee_id',staff,
    'employees', coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('access_linked',exists(select 1 from public.memberships m where m.restaurant_id=venue and m.employee_id=e.id and m.active)) order by e.last_name,e.id) from public.employees e where e.restaurant_id=venue and (access_role in ('owner','admin') or e.id=staff)),'[]'),
    'shifts',coalesce((select jsonb_agg(to_jsonb(s)-'slot' order by s.date,s.start_time,s.id) from public.shifts s where s.restaurant_id=venue and (access_role in ('owner','admin') or s.employee_id=staff)),'[]')
  );
end $$;

-- Caller-generated UUID makes onboarding retryable after a lost response.
create function public.create_restaurant(p_restaurant_id uuid,p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception using errcode='42501',message='confirmed_account_required'; end if;
  if p_restaurant_id is null then raise exception using errcode='22023',message='invalid_restaurant'; end if;
  perform private.lock_restaurant(p_restaurant_id);
  if exists(select 1 from public.restaurants where id=p_restaurant_id) then
    if not exists(select 1 from public.restaurants where id=p_restaurant_id and created_by=auth.uid() and name=trim(p_name)) or private.restaurant_role(p_restaurant_id) is null then raise exception using errcode='42501',message='restaurant_access_denied'; end if;
  else
    insert into public.restaurants(id,name,created_by) values(p_restaurant_id,trim(p_name),auth.uid());
    insert into public.memberships(restaurant_id,user_id,role) values(p_restaurant_id,auth.uid(),'owner');
  end if;
  return public.workspace_snapshot(p_restaurant_id);
end $$;

create function public.restaurant_access(p_restaurant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.restaurant_role(p_restaurant_id) is distinct from 'owner' then raise exception using errcode='42501',message='owner_required'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'employee_id',m.employee_id,'active',m.active,'revision',m.revision,'available',(m.active and u.email_confirmed_at is not null and (m.role='owner' or m.employee_id is null or exists(select 1 from public.employees e where e.restaurant_id=m.restaurant_id and e.id=m.employee_id and e.active and e.email=lower(u.email))))) order by u.email) from public.memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=p_restaurant_id),'[]'),
    'invitations',coalesce((select jsonb_agg(to_jsonb(i)-'token_hash'-'created_by' order by i.expires_at desc) from private.invitations i where i.restaurant_id=p_restaurant_id and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()),'[]')
  );
end $$;
create function public.apply_workspace_changes(
  p_request_id uuid,
  p_restaurant_id uuid,
  p_employee_changes jsonb default '[]',
  p_shift_changes jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  change jsonb; data jsonb; record_id text; expected integer;
  old_employee public.employees; new_employee public.employees;
  new_shift public.shifts; old_shift public.shifts;
  receipt private.mutation_receipts;
  payload_hash text := md5(p_restaurant_id::text || ':' || p_employee_changes::text || ':' || p_shift_changes::text);
begin
  -- Serializes permission changes with business mutations for this establishment.
  perform private.lock_restaurant(p_restaurant_id);
  if not coalesce(private.restaurant_role(p_restaurant_id) in ('owner', 'admin'), false) then raise exception using errcode = '42501', message = 'workspace_admin_required'; end if;
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
    return public.workspace_snapshot(p_restaurant_id);
  end if;

  for change in select value from jsonb_array_elements(p_employee_changes) loop
    data := change->'data'; record_id := coalesce(data->>'id', change->>'id');
    expected := (change->>'expected_revision')::integer;
    select * into old_employee from public.employees where restaurant_id = p_restaurant_id and id = record_id;
    if (expected is null and found) or (expected is not null and (not found or old_employee.revision <> expected)) then
      raise exception using errcode = '40001', message = 'stale_record';
    end if;
    if change->>'kind' = 'delete' then
      if expected is null then raise exception using errcode = '22023', message = 'revision_required'; end if;
      if exists(select 1 from public.memberships where restaurant_id = p_restaurant_id and employee_id = record_id) then raise exception using errcode = '23001', message = 'linked_employee'; end if;
      delete from public.employees where restaurant_id = p_restaurant_id and id = record_id;
    elsif change->>'kind' = 'save' and jsonb_typeof(data) = 'object' then
      if data - array['id','first_name','last_name','email','phone','position','department','contract_type','start_date','end_date','hourly_rate','monthly_hours','social_security_number','address','postal_code','city','bank_rib','role','active','night_work'] <> '{}'::jsonb then
        raise exception using errcode = '22023', message = 'unsupported_employee_field';
      end if;
      new_employee := jsonb_populate_record(null::public.employees, data);
      if exists(select 1 from public.memberships where restaurant_id = p_restaurant_id and employee_id = record_id)
        and new_employee.email is distinct from old_employee.email then
        raise exception using errcode = '22023', message = 'linked_email_change';
      end if;
      if new_employee.role <> 'employee' then
        raise exception using errcode = '22023', message = 'manage_role_in_access';
      end if;
      if expected is null then
        insert into public.employees (restaurant_id, id, first_name, last_name, email, phone, position, department, contract_type, start_date, end_date, hourly_rate, monthly_hours, social_security_number, address, postal_code, city, bank_rib, role, active, night_work)
        values (p_restaurant_id, new_employee.id, new_employee.first_name, new_employee.last_name, new_employee.email, new_employee.phone, new_employee.position, new_employee.department, new_employee.contract_type, new_employee.start_date, new_employee.end_date, new_employee.hourly_rate, new_employee.monthly_hours, new_employee.social_security_number, new_employee.address, new_employee.postal_code, new_employee.city, new_employee.bank_rib, new_employee.role, new_employee.active, new_employee.night_work);
      else
        update public.employees set first_name = new_employee.first_name, last_name = new_employee.last_name, email = new_employee.email, phone = new_employee.phone, position = new_employee.position, department = new_employee.department, contract_type = new_employee.contract_type, start_date = new_employee.start_date, end_date = new_employee.end_date, hourly_rate = new_employee.hourly_rate, monthly_hours = new_employee.monthly_hours, social_security_number = new_employee.social_security_number, address = new_employee.address, postal_code = new_employee.postal_code, city = new_employee.city, bank_rib = new_employee.bank_rib, role = new_employee.role, active = new_employee.active, night_work = new_employee.night_work, revision = revision + 1, updated_at = now()
        where restaurant_id = p_restaurant_id and id = record_id;
      end if;
    else raise exception using errcode = '22023', message = 'invalid_employee_change'; end if;
  end loop;

  for change in select value from jsonb_array_elements(p_shift_changes) loop
    data := change->'data'; record_id := coalesce(data->>'id', change->>'id');
    expected := (change->>'expected_revision')::integer;
    select * into old_shift from public.shifts where restaurant_id = p_restaurant_id and id = record_id;
    if (expected is null and found) or (expected is not null and (not found or old_shift.revision <> expected)) then
      raise exception using errcode = '40001', message = 'stale_record';
    end if;
    if change->>'kind' = 'delete' then
      if expected is null then raise exception using errcode = '22023', message = 'revision_required'; end if;
      delete from public.shifts where restaurant_id = p_restaurant_id and id = record_id;
    elsif change->>'kind' = 'save' and jsonb_typeof(data) = 'object' then
      if data - array['id','employee_id','date','start_time','end_time','role','notes','is_night_shift','status'] <> '{}'::jsonb then
        raise exception using errcode = '22023', message = 'unsupported_shift_field';
      end if;
      new_shift := jsonb_populate_record(null::public.shifts, data);
      -- Keep historical attendance/notes editable after archiving, but no new assignment.
      if (expected is null or (old_shift.employee_id, old_shift.date, old_shift.start_time, old_shift.end_time) is distinct from (new_shift.employee_id, new_shift.date, new_shift.start_time, new_shift.end_time))
        and not exists(select 1 from public.employees where restaurant_id = p_restaurant_id and id = new_shift.employee_id and active) then
        raise exception using errcode = '23514', message = 'inactive_employee';
      end if;
      if expected is null then
        insert into public.shifts (restaurant_id, id, employee_id, date, start_time, end_time, role, notes, is_night_shift, status)
        values (p_restaurant_id, new_shift.id, new_shift.employee_id, new_shift.date, new_shift.start_time, new_shift.end_time, new_shift.role, new_shift.notes, new_shift.is_night_shift, new_shift.status);
      else
        update public.shifts set employee_id = new_shift.employee_id, date = new_shift.date, start_time = new_shift.start_time, end_time = new_shift.end_time, role = new_shift.role, notes = new_shift.notes, is_night_shift = new_shift.is_night_shift, status = new_shift.status, revision = revision + 1, updated_at = now() where restaurant_id = p_restaurant_id and id = record_id;
      end if;
    else raise exception using errcode = '22023', message = 'invalid_shift_change'; end if;
  end loop;
  insert into private.mutation_receipts(request_id, actor, payload_hash) values (p_request_id, auth.uid(), payload_hash);
  return public.workspace_snapshot(p_restaurant_id);
end;
$$;

create function public.create_invitation(p_restaurant_id uuid,p_email text,p_role text,p_employee_id text,p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; invitation private.invitations; target_email text := lower(trim(p_email)); hashed_token text := encode(sha256(convert_to(p_token,'UTF8')),'hex');
begin
  perform private.lock_restaurant(p_restaurant_id);
  if private.restaurant_role(p_restaurant_id) is distinct from 'owner' then raise exception using errcode='42501',message='owner_required'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or target_email is null or length(target_email)>254 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in ('admin','employee') then raise exception using errcode='22023',message='invalid_invitation'; end if;
  if (p_role='employee' and p_employee_id is null) or (p_role='admin' and p_employee_id is not null) or (p_employee_id is not null and not exists(select 1 from public.employees where restaurant_id=p_restaurant_id and id=p_employee_id and email=target_email and active)) then raise exception using errcode='22023',message='invitation_employee_mismatch'; end if;
  if p_employee_id is not null and exists(select 1 from public.memberships where restaurant_id=p_restaurant_id and employee_id=p_employee_id) then raise exception using errcode='23505',message='linked_employee'; end if;
  if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=p_restaurant_id and lower(u.email)=target_email) then raise exception using errcode='23505',message='already_member'; end if;
  select * into invitation from private.invitations i where i.token_hash=hashed_token;
  if found then
    if invitation.restaurant_id=p_restaurant_id and invitation.email=target_email and invitation.role=p_role and invitation.employee_id is not distinct from p_employee_id and invitation.revoked_at is null and invitation.accepted_at is null and invitation.expires_at>now() then return invitation.id; end if;
    raise exception using errcode='22023',message='invitation_token_reused';
  end if;
  update private.invitations set revoked_at=now() where restaurant_id=p_restaurant_id and email=target_email and accepted_at is null and revoked_at is null;
  insert into private.invitations(restaurant_id,email,role,employee_id,token_hash,created_by) values(p_restaurant_id,target_email,p_role,p_employee_id,hashed_token,auth.uid()) returning id into result;
  return result;
end $$;

create function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare invitation private.invitations; account_email text;
begin
  select lower(email) into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if account_email is null then raise exception using errcode='42501',message='confirmed_account_required'; end if;
  select * into invitation from private.invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception using errcode='22023',message='invalid_invitation'; end if;
  perform private.lock_restaurant(invitation.restaurant_id);
  select * into invitation from private.invitations where id=invitation.id;
  if invitation.email<>account_email then raise exception using errcode='42501',message='invitation_email_mismatch'; end if;
  -- An accepted link may be retried, but can never restore a revoked membership.
  if invitation.accepted_by=auth.uid() and private.restaurant_role(invitation.restaurant_id) is not null then return public.workspace_snapshot(invitation.restaurant_id); end if;
  if invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at<=now() then raise exception using errcode='22023',message='invitation_expired'; end if;
  if invitation.employee_id is not null and not exists(select 1 from public.employees where restaurant_id=invitation.restaurant_id and id=invitation.employee_id and active and email=account_email) then raise exception using errcode='22023',message='invitation_employee_mismatch'; end if;
  if exists(select 1 from public.memberships where restaurant_id=invitation.restaurant_id and user_id=auth.uid()) then raise exception using errcode='23505',message='already_member'; end if;
  if invitation.employee_id is not null and exists(select 1 from public.memberships where restaurant_id=invitation.restaurant_id and employee_id=invitation.employee_id) then raise exception using errcode='23505',message='linked_employee'; end if;
  insert into public.memberships(restaurant_id,user_id,role,employee_id) values(invitation.restaurant_id,auth.uid(),invitation.role,invitation.employee_id)
  on conflict (restaurant_id,user_id) do update set role=excluded.role, employee_id=excluded.employee_id, active=true, revision=memberships.revision+1;
  update private.invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
  return public.workspace_snapshot(invitation.restaurant_id);
end $$;

create function public.revoke_invitation(p_restaurant_id uuid,p_invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_restaurant(p_restaurant_id);
  if private.restaurant_role(p_restaurant_id) is distinct from 'owner' then raise exception using errcode='42501',message='owner_required'; end if;
  update private.invitations set revoked_at=coalesce(revoked_at,now()) where restaurant_id=p_restaurant_id and id=p_invitation_id and accepted_at is null;
end $$;

create function public.update_member_access(p_restaurant_id uuid,p_user_id uuid,p_role text,p_active boolean,p_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
declare member public.memberships;
begin
  perform private.lock_restaurant(p_restaurant_id);
  if private.restaurant_role(p_restaurant_id) is distinct from 'owner' then raise exception using errcode='42501',message='owner_required'; end if;
  select * into member from public.memberships where restaurant_id=p_restaurant_id and user_id=p_user_id;
  if not found or p_revision is null or member.revision<>p_revision then raise exception using errcode='40001',message='stale_record'; end if;
  if p_role is null or p_role not in ('owner','admin','employee') or p_active is null or (p_role='employee' and member.employee_id is null) then raise exception using errcode='22023',message='invalid_member_role'; end if;
  if member.role='owner' and member.active and (not p_active or p_role<>'owner') and not exists(
    select 1 from public.memberships m join auth.users u on u.id=m.user_id
    where m.restaurant_id=p_restaurant_id and m.user_id<>p_user_id and m.active and m.role='owner'
      and u.email_confirmed_at is not null
  ) then raise exception using errcode='42501',message='last_owner'; end if;
  -- Keep the optional staff link so a promoted owner can later return to employee.
  -- The link never limits an owner's access when that staff record is archived.
  update public.memberships set role=p_role,active=p_active,revision=revision+1 where restaurant_id=p_restaurant_id and user_id=p_user_id;
end $$;

revoke all on function public.workspace_snapshot(uuid), public.create_restaurant(uuid,text), public.apply_workspace_changes(uuid,uuid,jsonb,jsonb), public.restaurant_access(uuid), public.create_invitation(uuid,text,text,text,text), public.accept_invitation(text), public.revoke_invitation(uuid,uuid), public.update_member_access(uuid,uuid,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.workspace_snapshot(uuid), public.create_restaurant(uuid,text), public.apply_workspace_changes(uuid,uuid,jsonb,jsonb), public.restaurant_access(uuid), public.create_invitation(uuid,text,text,text,text), public.accept_invitation(text), public.revoke_invitation(uuid,uuid), public.update_member_access(uuid,uuid,text,boolean,integer) to authenticated;
