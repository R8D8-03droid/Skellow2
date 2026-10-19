-- Run the whole file as postgres after both migrations. All synthetic data is
-- created inside this transaction and rolled back, even on an occupied project.
-- With psql, use -v ON_ERROR_STOP=1. Never replace ROLLBACK with COMMIT.
begin;
set local statement_timeout = '30s';

do $qa$ begin
  if to_regprocedure('public.create_restaurant(uuid,text)') is null
    or to_regprocedure('public.workspace_snapshot(uuid)') is null
    or to_regprocedure('public.apply_workspace_changes(uuid,uuid,jsonb,jsonb)') is null
    or to_regprocedure('public.accept_invitation(text)') is null then
    raise exception 'SaaS migration is required before this recipe';
  end if;
end $qa$;

-- Fresh UUIDs and reserved example.invalid addresses avoid touching real users.
select set_config('qa.owner',gen_random_uuid()::text,true);
select set_config('qa.staff',gen_random_uuid()::text,true);
select set_config('qa.outsider',gen_random_uuid()::text,true);
select set_config('qa.unconfirmed',gen_random_uuid()::text,true);
select set_config('qa.venue_a',gen_random_uuid()::text,true);
select set_config('qa.venue_b',gen_random_uuid()::text,true);
select set_config('qa.staff_email','qa-' || current_setting('qa.staff') || '@example.invalid',true);
select set_config('qa.token_a',md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text),true);
select set_config('qa.token_b',md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text),true);
select set_config('qa.write_a',gen_random_uuid()::text,true);
select set_config('qa.write_b',gen_random_uuid()::text,true);

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (current_setting('qa.owner')::uuid,'qa-' || current_setting('qa.owner') || '@example.invalid',now(),'{}'),
  (current_setting('qa.staff')::uuid,current_setting('qa.staff_email'),now(),'{}'),
  (current_setting('qa.outsider')::uuid,'qa-' || current_setting('qa.outsider') || '@example.invalid',now(),'{"role":"owner"}'),
  (current_setting('qa.unconfirmed')::uuid,'qa-' || current_setting('qa.unconfirmed') || '@example.invalid',null,'{"role":"owner"}');

select set_config('qa.employee_change',jsonb_build_array(jsonb_build_object(
  'kind','save','expected_revision',null,'data',jsonb_build_object(
    'id','qa-staff','first_name','Test','last_name','Recette',
    'email',current_setting('qa.staff_email'),'phone','','position','Service',
    'department','Salle','contract_type','CDI','start_date','2026-10-19',
    'end_date',null,'hourly_rate',15,'monthly_hours',151.67,
    'social_security_number','','address','','postal_code','','city','','bank_rib','',
    'role','employee','active',true,'night_work',false
  )
))::text,true);
select set_config('qa.shift_change',jsonb_build_array(jsonb_build_object(
  'kind','save','expected_revision',null,'data',jsonb_build_object(
    'id','qa-service','employee_id','qa-staff','date','2026-10-20',
    'start_time','18:00','end_time','23:00','role','Service',
    'notes','','is_night_shift',false,'status','scheduled'
  )
))::text,true);

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $qa$ begin
  begin perform 1 from public.employees; raise exception 'anonymous employee read was allowed';
  exception when sqlstate '42501' then null; end;
  begin perform public.workspace_snapshot(null); raise exception 'anonymous snapshot was allowed';
  exception when sqlstate '42501' then null; end;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.unconfirmed'),true);
do $qa$ begin
  begin perform public.workspace_snapshot(null); raise exception 'unconfirmed account got a snapshot';
  exception when sqlstate '42501' then null; end;
  begin perform public.create_restaurant(gen_random_uuid(),'QA interdit');
    raise exception 'unconfirmed account created a restaurant';
  exception when sqlstate '42501' then null; end;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.outsider'),true);
do $qa$ begin
  if (public.workspace_snapshot(null)->'restaurants') <> '[]'::jsonb
    or (select count(*) from public.employees) <> 0 then
    raise exception 'unlinked account can see existing restaurant data';
  end if;
end $qa$;
select public.create_restaurant(current_setting('qa.venue_b')::uuid,'QA Restaurant B');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
select public.create_restaurant(current_setting('qa.venue_a')::uuid,'QA Restaurant A');
select public.create_restaurant(current_setting('qa.venue_a')::uuid,'QA Restaurant A');
do $qa$ begin
  if (public.workspace_snapshot(current_setting('qa.venue_a')::uuid)->>'membership_role') <> 'owner' then
    raise exception 'creator did not become owner';
  end if;
  begin perform public.workspace_snapshot(current_setting('qa.venue_b')::uuid);
    raise exception 'owner read another restaurant';
  exception when sqlstate '42501' then null; end;
  begin perform public.apply_workspace_changes(gen_random_uuid(),current_setting('qa.venue_b')::uuid,'[]','[]');
    raise exception 'owner wrote to another restaurant';
  exception when sqlstate '42501' then null; end;
end $qa$;

select public.apply_workspace_changes(current_setting('qa.write_a')::uuid,current_setting('qa.venue_a')::uuid,current_setting('qa.employee_change')::jsonb,'[]');
select public.apply_workspace_changes(current_setting('qa.write_a')::uuid,current_setting('qa.venue_a')::uuid,current_setting('qa.employee_change')::jsonb,'[]');
select public.apply_workspace_changes(current_setting('qa.write_b')::uuid,current_setting('qa.venue_a')::uuid,'[]',current_setting('qa.shift_change')::jsonb);
do $qa$ begin
  if (select count(*) from public.employees where restaurant_id=current_setting('qa.venue_a')::uuid) <> 1
    or (select count(*) from public.shifts where restaurant_id=current_setting('qa.venue_a')::uuid) <> 1
    or (select revision from public.employees where restaurant_id=current_setting('qa.venue_a')::uuid and id='qa-staff') <> 1 then
    raise exception 'writes or idempotent retry did not produce one employee and shift';
  end if;
  if (select count(*) from public.employees) <> 1 then
    raise exception 'RLS exposed employees in other restaurants';
  end if;
  begin update public.employees set role='admin' where restaurant_id=current_setting('qa.venue_a')::uuid;
    raise exception 'direct employee update was allowed';
  exception when sqlstate '42501' then null; end;
  begin perform 1 from private.mutation_receipts; raise exception 'private receipts were readable';
  exception when sqlstate '42501' then null; end;
  begin perform public.update_member_access(current_setting('qa.venue_a')::uuid,current_setting('qa.owner')::uuid,'admin',true,1);
    raise exception 'last owner was demoted';
  exception when sqlstate '42501' then null; end;
end $qa$;

do $qa$ begin
  begin perform public.create_invitation(current_setting('qa.venue_a')::uuid,
    current_setting('qa.staff_email'),'admin','qa-staff',md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text));
    raise exception 'admin invitation was linked to a staff record';
  exception when sqlstate '22023' then null; end;
end $qa$;
select set_config('qa.invitation_a',public.create_invitation(
  current_setting('qa.venue_a')::uuid,current_setting('qa.staff_email'),'employee','qa-staff',current_setting('qa.token_a')
)::text,true);
do $qa$ begin
  if public.create_invitation(current_setting('qa.venue_a')::uuid,current_setting('qa.staff_email'),'employee','qa-staff',current_setting('qa.token_a'))::text
      <> current_setting('qa.invitation_a') then
    raise exception 'invitation retry produced a second row';
  end if;
  if (public.restaurant_access(current_setting('qa.venue_a')::uuid)::text like '%' || current_setting('qa.token_a') || '%')
    or (public.restaurant_access(current_setting('qa.venue_a')::uuid)::text like '%token_hash%') then
    raise exception 'invitation secret appeared in access listing';
  end if;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.outsider'),true);
do $qa$ begin
  begin perform public.accept_invitation(current_setting('qa.token_a'));
    raise exception 'invitation accepted by a different email';
  exception when sqlstate '42501' then null; end;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.staff'),true);
do $qa$ declare snapshot jsonb;
begin
  snapshot := public.accept_invitation(current_setting('qa.token_a'));
  if snapshot->>'membership_role' <> 'employee'
    or jsonb_array_length(snapshot->'employees') <> 1
    or jsonb_array_length(snapshot->'shifts') <> 1
    or snapshot->'employees'->0->>'id' <> 'qa-staff'
    or snapshot->'shifts'->0->>'id' <> 'qa-service' then
    raise exception 'employee snapshot contained the wrong data';
  end if;
  if (select count(*) from public.shifts) <> 1 then
    raise exception 'employee direct RLS read exposed other shifts';
  end if;
  begin perform public.restaurant_access(current_setting('qa.venue_a')::uuid);
    raise exception 'employee listed account access';
  exception when sqlstate '42501' then null; end;
  begin perform public.apply_workspace_changes(gen_random_uuid(),current_setting('qa.venue_a')::uuid,'[]','[]');
    raise exception 'employee changed business data';
  exception when sqlstate '42501' then null; end;
end $qa$;

reset role;
update auth.users set email='changed-' || current_setting('qa.staff') || '@example.invalid'
where id=current_setting('qa.staff')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.staff'),true);
do $qa$ begin
  begin perform public.workspace_snapshot(current_setting('qa.venue_a')::uuid);
    raise exception 'changed employee email retained restaurant access';
  exception when sqlstate '42501' then null; end;
  if (select count(*) from public.employees) <> 0 then
    raise exception 'changed employee email retained direct RLS access';
  end if;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
do $qa$ begin
  if (select value->>'available' from jsonb_array_elements(public.restaurant_access(current_setting('qa.venue_a')::uuid)->'members') value
      where value->>'user_id'=current_setting('qa.staff')) <> 'false' then
    raise exception 'changed employee email remained available to owner';
  end if;
end $qa$;

reset role;
update auth.users set email=current_setting('qa.staff_email') where id=current_setting('qa.staff')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.staff'),true);
do $qa$ begin
  if (public.workspace_snapshot(current_setting('qa.venue_a')::uuid)->>'membership_role') <> 'employee' then
    raise exception 'restored employee email did not restore access';
  end if;
end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
select set_config('qa.invitation_b',public.create_invitation(
  current_setting('qa.venue_a')::uuid,
  'qa-' || current_setting('qa.outsider') || '@example.invalid',
  'admin',null,current_setting('qa.token_b')
)::text,true);
select public.revoke_invitation(current_setting('qa.venue_a')::uuid,current_setting('qa.invitation_b')::uuid);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.outsider'),true);
do $qa$ begin
  begin perform public.accept_invitation(current_setting('qa.token_b'));
    raise exception 'revoked invitation was accepted';
  exception when sqlstate '22023' then null; end;
  if (public.workspace_snapshot(current_setting('qa.venue_b')::uuid)->>'membership_role') <> 'owner' then
    raise exception 'second restaurant owner lost access';
  end if;
end $qa$;

reset role;
select 'SaaS hosted smoke passed; transaction will now roll back' as validation;
rollback;
