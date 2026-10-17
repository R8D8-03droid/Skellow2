-- Run as postgres only on an empty Skellow database. All fixtures are rolled back.
-- No passwords, persistent accounts, or employee data are created.
-- With psql, require -v ON_ERROR_STOP=1. In SQL Editor, execute the whole file.
-- Success is reported inside the test transaction; cleanup counts are separate.
begin;
set local statement_timeout = '30s';

do $qa$ begin if not ((select count(*)=0 from public.employees) and (select count(*)=0 from public.shifts) and (select count(*)=0 from auth.users) and (select count(*)=0 from private.mutation_receipts)) then raise exception 'FAILED: empty database precondition'; end if; end $qa$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('10000000-0000-4000-8000-000000000001','qa-admin@example.com',now(),'{"role":"admin"}'::jsonb),('10000000-0000-4000-8000-000000000002','qa-member@example.com',now(),'{"role":"admin"}'::jsonb),('10000000-0000-4000-8000-000000000003','qa-stranger@example.com',now(),'{"role":"admin"}'::jsonb);
select private.bootstrap_admin('10000000-0000-4000-8000-000000000001','QA','Admin');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);

do $qa$ begin begin perform 1 from public.employees; raise exception 'FAILED: anonymous table read denied'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform public.workspace_snapshot(); raise exception 'FAILED: anonymous RPC denied'; exception when sqlstate '42501' then null; end; end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);

do $qa$ begin if not ((select count(*)=0 from public.employees) and (select count(*)=0 from public.shifts)) then raise exception 'FAILED: unlinked user RLS hides all data'; end if; end $qa$;

do $qa$ begin begin perform public.workspace_snapshot(); raise exception 'FAILED: spoofed metadata does not grant access'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000001','[{"kind":"save","data":{"id":"qa-forbidden","first_name":"Test","last_name":"qa-forbidden","email":"qa-forbidden@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[]'::jsonb); raise exception 'FAILED: unlinked user mutation denied'; exception when sqlstate '42501' then null; end; end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

select public.apply_workspace_changes('20000000-0000-4000-8000-000000000002','[{"kind":"save","data":{"id":"qa-member","first_name":"Test","last_name":"qa-member","email":"qa-member@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null},{"kind":"save","data":{"id":"qa-other","first_name":"Test","last_name":"qa-other","email":"qa-other@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[]'::jsonb);

do $qa$ begin if not ((select jsonb_array_length(public.workspace_snapshot()->'employees')=3)) then raise exception 'FAILED: admin creates and sees three employees'; end if; end $qa$;

do $qa$ begin if not (not exists(select 1 from jsonb_array_elements(public.workspace_snapshot()->'employees') e where e ? 'auth_user_id' or e ? 'password')) then raise exception 'FAILED: snapshot hides auth identities'; end if; end $qa$;

do $qa$ begin begin update public.employees set role='admin' where id='qa-member'; raise exception 'FAILED: direct table updates denied'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform 1 from private.mutation_receipts; raise exception 'FAILED: private receipts unreadable'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform private.bootstrap_admin('10000000-0000-4000-8000-000000000003','Other','Admin'); raise exception 'FAILED: bootstrap unavailable to app'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000003','[{"kind":"save","data":{"id":"qa-bad","first_name":"Test","last_name":"qa-bad","email":"qa-bad@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true,"auth_user_id":"10000000-0000-4000-8000-000000000003"},"expected_revision":null}]'::jsonb,'[]'::jsonb); raise exception 'FAILED: protected identity fields rejected'; exception when sqlstate '22023' then null; end; end $qa$;

reset role;
select private.link_employee_account('qa-member','10000000-0000-4000-8000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

select public.apply_workspace_changes('20000000-0000-4000-8000-000000000004','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-night","employee_id":"qa-member","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null},{"kind":"save","data":{"id":"qa-other-night","employee_id":"qa-other","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);

do $qa$ begin if not ((select jsonb_array_length(s->'employees')=1 and s->'employees'->0->>'id'='qa-member' and jsonb_array_length(s->'shifts')=1 and s->'shifts'->0->>'id'='qa-night' from (select public.workspace_snapshot() s) x)) then raise exception 'FAILED: employee snapshot contains only own data'; end if; end $qa$;

do $qa$ begin if not ((select count(*)=1 and min(id)='qa-night' from public.shifts)) then raise exception 'FAILED: direct RLS reads filter shifts'; end if; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000005','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-forbidden","employee_id":"qa-member","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb); raise exception 'FAILED: employee mutation denied'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform private.link_employee_account('qa-member','10000000-0000-4000-8000-000000000003'); raise exception 'FAILED: employee cannot link accounts'; exception when sqlstate '42501' then null; end; end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000006','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-overlap","employee_id":"qa-member","date":"2026-10-13","start_time":"04:00","end_time":"06:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb); raise exception 'FAILED: overnight overlap rejected'; exception when sqlstate '23P01' then null; end; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000007','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-zero","employee_id":"qa-member","date":"2026-10-14","start_time":"22:00","end_time":"22:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb); raise exception 'FAILED: zero duration rejected'; exception when sqlstate '23514' then null; end; end $qa$;

select public.apply_workspace_changes('20000000-0000-4000-8000-000000000008','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-touch","employee_id":"qa-member","date":"2026-10-13","start_time":"05:00","end_time":"06:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb);

do $qa$ begin if not ((select count(*)=1 from public.shifts where id='qa-touch')) then raise exception 'FAILED: touching endpoints allowed'; end if; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-9000-000000000001','[{"kind":"save","data":{"id":"qa-rollback","first_name":"Test","last_name":"qa-rollback","email":"qa-rollback@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[{"kind":"save","data":{"id":"qa-batch-ok","employee_id":"qa-member","date":"2026-11-01","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null},{"kind":"save","data":{"id":"qa-batch-conflict","employee_id":"qa-member","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb); raise exception 'FAILED: failed batch rejected'; exception when sqlstate '23P01' then null; end; end $qa$;

do $qa$ begin if not ((select count(*)=0 from public.employees where id='qa-rollback') and (select count(*)=0 from public.shifts where id='qa-batch-ok')) then raise exception 'FAILED: failed batch leaves no partial rows'; end if; end $qa$;

reset role;

do $qa$ begin if not ((select count(*)=0 from private.mutation_receipts where request_id='20000000-0000-4000-9000-000000000001')) then raise exception 'FAILED: failed batch leaves no receipt'; end if; end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

select public.apply_workspace_changes('20000000-0000-4000-8000-000000000009','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-night","employee_id":"qa-member","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"Saved once","is_night_shift":true,"status":"scheduled"},"expected_revision":1}]'::jsonb);

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000010','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-night","employee_id":"qa-member","date":"2026-10-12","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"Stale","is_night_shift":true,"status":"scheduled"},"expected_revision":1}]'::jsonb); raise exception 'FAILED: stale revision rejected'; exception when sqlstate '40001' then null; end; end $qa$;

do $qa$ begin if not ((select revision=2 and notes='Saved once' from public.shifts where id='qa-night')) then raise exception 'FAILED: stale edit preserves current version'; end if; end $qa$;

select public.apply_workspace_changes('20000000-0000-4000-9000-000000000002','[{"kind":"save","data":{"id":"qa-retry","first_name":"Test","last_name":"qa-retry","email":"qa-retry@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[]'::jsonb);
select public.apply_workspace_changes('20000000-0000-4000-9000-000000000002','[{"kind":"save","data":{"id":"qa-retry","first_name":"Test","last_name":"qa-retry","email":"qa-retry@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[]'::jsonb);

do $qa$ begin if not ((select count(*)=1 and min(revision)=1 from public.employees where id='qa-retry')) then raise exception 'FAILED: idempotent retry creates exactly one version'; end if; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-9000-000000000002','[{"kind":"save","data":{"id":"qa-changed","first_name":"Test","last_name":"qa-changed","email":"qa-changed@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":null}]'::jsonb,'[]'::jsonb); raise exception 'FAILED: request UUID cannot accept different content'; exception when sqlstate '22023' then null; end; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000011','[{"kind":"save","data":{"id":"qa-member","first_name":"Test","last_name":"qa-member","email":"different@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":true,"night_work":true},"expected_revision":2}]'::jsonb,'[]'::jsonb); raise exception 'FAILED: linked email cannot diverge'; exception when sqlstate '22023' then null; end; end $qa$;

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-9000-000000000003',jsonb_build_array(jsonb_build_object('kind','delete','id',private.current_employee_id(),'expected_revision',1)),'[]'); raise exception 'FAILED: own admin access preserved'; exception when sqlstate '42501' then null; end; end $qa$;

select public.apply_workspace_changes('20000000-0000-4000-8000-000000000012','[{"kind":"save","data":{"id":"qa-member","first_name":"Test","last_name":"qa-member","email":"qa-member@example.com","phone":"","position":"DJ","department":"Animation","contract_type":"CDI","start_date":"2026-01-01","end_date":null,"hourly_rate":20,"monthly_hours":151.67,"social_security_number":"","address":"","postal_code":"","city":"","bank_rib":"","role":"employee","active":false,"night_work":true},"expected_revision":2}]'::jsonb,'[]'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);

do $qa$ begin if not ((select count(*)=0 from public.employees) and (select count(*)=0 from public.shifts)) then raise exception 'FAILED: archived employee has no table access'; end if; end $qa$;

do $qa$ begin begin perform public.workspace_snapshot(); raise exception 'FAILED: archived employee snapshot denied'; exception when sqlstate '42501' then null; end; end $qa$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $qa$ begin begin perform public.apply_workspace_changes('20000000-0000-4000-8000-000000000013','[]'::jsonb,'[{"kind":"save","data":{"id":"qa-archived","employee_id":"qa-member","date":"2026-12-01","start_time":"22:00","end_time":"05:00","role":"DJ","notes":"","is_night_shift":true,"status":"scheduled"},"expected_revision":null}]'::jsonb); raise exception 'FAILED: archived employee cannot receive shifts'; exception when sqlstate '23514' then null; end; end $qa$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);

do $qa$ begin begin perform private.bootstrap_admin('10000000-0000-4000-8000-000000000003','Other','Admin'); raise exception 'FAILED: service role cannot bootstrap'; exception when sqlstate '42501' then null; end; end $qa$;

do $qa$ begin begin perform private.link_employee_account('qa-member','10000000-0000-4000-8000-000000000002'); raise exception 'FAILED: service role cannot link accounts'; exception when sqlstate '42501' then null; end; end $qa$;

reset role;
select '33 checks passed' as validation;
rollback;
select (select count(*) from public.employees) as employees_after_rollback, (select count(*) from public.shifts) as shifts_after_rollback, (select count(*) from auth.users) as auth_users_after_rollback, (select count(*) from private.mutation_receipts) as receipts_after_rollback;
