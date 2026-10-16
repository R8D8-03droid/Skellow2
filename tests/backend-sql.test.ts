import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const db = new PGlite({ extensions: { btree_gist } });
const admin = '10000000-0000-4000-8000-000000000001';
const member = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
let adminId: string;
const employee = (id: string, email = `${id}@example.com`) => ({ id, first_name: 'Test', last_name: id, email, phone: '', position: 'DJ', department: 'Animation', contract_type: 'CDI', start_date: '2026-01-01', end_date: null, hourly_rate: 20, monthly_hours: 151.67, social_security_number: '', address: '', postal_code: '', city: '', bank_rib: '', role: 'employee', active: true, night_work: true });
const shift = (id: string, employee_id = 'member', date = '2026-10-12', start_time = '22:00', end_time = '05:00') => ({ id, employee_id, date, start_time, end_time, role: 'DJ', notes: '', is_night_shift: true, status: 'scheduled' });
const save = (data: object, expected_revision: number | null = null) => ({ kind: 'save', data, expected_revision });
const del = (id: string, expected_revision: number) => ({ kind: 'delete', id, expected_revision });
async function as(role: string, uid: string | null, action: () => Promise<any>) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid || '']);
    const result = await action();
    await db.exec('commit');
    return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
async function mutate(employees: object[] = [], shifts: object[] = [], request = crypto.randomUUID(), actor = admin) {
  return as('authenticated', actor, async () => (await db.query<{ snapshot: any }>('select public.apply_workspace_changes($1, $2::jsonb, $3::jsonb) as snapshot', [request, JSON.stringify(employees), JSON.stringify(shifts)])).rows[0].snapshot);
}
async function snapshot(actor = admin) {
  return as('authenticated', actor, async () => (await db.query<{ snapshot: any }>('select public.workspace_snapshot() as snapshot')).rows[0].snapshot);
}
async function rejected(action: Promise<unknown>, code: string) { await assert.rejects(action, (e: any) => { assert.equal(e.code, code); return true; }); }
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role; grant execute on function auth.uid() to public;`);
  for (const [id, email] of [[admin, 'admin@example.com'], [member, 'member@example.com'], [stranger, 'stranger@example.com']]) await db.query('insert into auth.users values ($1,$2,now(),$3::jsonb)', [id, email, '{"role":"admin"}']);
  await db.exec(await readFile(new URL('../supabase/migrations/202610160001_workspace.sql', import.meta.url), 'utf8'));
  adminId = (await db.query<{id:string}>("select private.bootstrap_admin($1,'Admin','Test') as id", [admin])).rows[0].id;
});
after(() => db.close());

test('operator bootstrap cannot run twice or be called by browser roles', async () => {
  await assert.rejects(db.query("select private.bootstrap_admin($1,'Other','Admin')", [stranger]));
  await rejected(as('authenticated', admin, () => db.query("select private.bootstrap_admin($1,'Other','Admin')", [stranger])), '42501');
  await rejected(as('service_role', null, () => db.query("select private.link_employee_account($1,$2)", [adminId, admin])), '42501');
});
test('anonymous and unlinked users cannot read or mutate data, including spoofed admin metadata', async () => {
  await rejected(as('anon', null, () => db.query('select * from public.employees')), '42501');
  await rejected(as('anon', null, () => db.query('select public.workspace_snapshot()')), '42501');
  const rows = await as('authenticated', stranger, () => db.query('select * from public.employees'));
  assert.equal(rows.rows.length, 0);
  await rejected(snapshot(stranger), '42501');
  await rejected(mutate([save(employee('unauthorized'))], [], crypto.randomUUID(), stranger), '42501');
});
test('admin creates members atomically and returned snapshot contains saved rows', async () => {
  const result = await mutate([save(employee('member')), save(employee('other'))]);
  assert.equal(result.employees.length, 3);
  assert.equal(result.employees.find((e:any) => e.id === 'member').revision, 1);
  assert.ok(result.employees.every((e:any) => !('auth_user_id' in e) && !('password' in e)));
  await db.query('select private.link_employee_account($1,$2)', ['member', member]);
  assert.equal((await snapshot()).employees.find((e:any) => e.id === 'member').revision, 2);
});
test('direct table writes and sensitive column assignment are rejected', async () => {
  await rejected(as('authenticated', admin, () => db.query("update public.employees set role='admin' where id='member'")), '42501');
  await rejected(mutate([save({...employee('bad-password'), password:'secret'})]), '22023');
  await rejected(mutate([save({...employee('bad-auth'), auth_user_id:stranger})]), '22023');
  await rejected(mutate([save({...employee('bad-revision'), revision:999})]), '22023');
  await rejected(as('authenticated', admin, () => db.query('select * from private.mutation_receipts')), '42501');
});
test('member sees only own fiche and shifts and cannot mutate or link an account', async () => {
  await mutate([], [save(shift('night')), save(shift('other-night', 'other'))]);
  const result = await snapshot(member);
  assert.deepEqual(result.employees.map((e:any) => e.id), ['member']);
  assert.deepEqual(result.shifts.map((s:any) => s.id), ['night']);
  assert.equal(result.current_employee_id, 'member');
  const rows = await as('authenticated', member, () => db.query('select id from public.shifts'));
  assert.deepEqual(rows.rows, [{id:'night'}]);
  await rejected(mutate([], [save(shift('nope'))], crypto.randomUUID(), member), '42501');
  await rejected(as('authenticated', member, () => db.query("select private.link_employee_account('member',$1)", [stranger])), '42501');
});
test('overnight conflicts, same-day overlaps and zero duration rejected; touching endpoints allowed', async () => {
  await rejected(mutate([], [save(shift('overnight-conflict','member','2026-10-13','04:00','06:00'))]), '23P01');
  await rejected(mutate([], [save(shift('same-day-conflict','member','2026-10-12','23:00','23:59'))]), '23P01');
  await rejected(mutate([], [save(shift('zero','member','2026-10-14','22:00','22:00'))]), '23514');
  const result = await mutate([], [save(shift('touch','member','2026-10-13','05:00','06:00'))]);
  assert.ok(result.shifts.some((s:any) => s.id === 'touch'));
  await rejected(mutate([], [save({...shift('seconds','member','2026-10-14'), start_time:'22:00:01'})]), '23514');
});
test('a failed batch rolls back earlier members, shifts and receipt', async () => {
  const request = crypto.randomUUID();
  await rejected(mutate([save(employee('rollback'))], [save(shift('batch-ok','member','2026-11-01')), save(shift('batch-bad'))], request), '23P01');
  const result = await snapshot();
  assert.ok(!result.employees.some((e:any) => e.id === 'rollback'));
  assert.ok(!result.shifts.some((s:any) => s.id === 'batch-ok'));
  assert.equal((await db.query('select * from private.mutation_receipts where request_id=$1',[request])).rows.length, 0);
});
test('stale edit and delete cannot overwrite another administrator’s changes', async () => {
  const changed = {...shift('night'), notes:'Saved once'};
  const result = await mutate([], [save(changed,1)]);
  assert.equal(result.shifts.find((s:any) => s.id === 'night').revision, 2);
  await rejected(mutate([], [save({...changed, notes:'Stale edit'},1)]), '40001');
  await rejected(mutate([], [del('night',1)]), '40001');
  assert.equal((await snapshot()).shifts.find((s:any) => s.id === 'night').notes, 'Saved once');
});
test('retry receipts prevent duplicate create/update and reject different payloads or actors', async () => {
  const request = crypto.randomUUID();
  const changes = [save(employee('retry'))];
  await mutate(changes,[],request);
  const retried = await mutate(changes,[],request);
  assert.equal(retried.employees.filter((e:any) => e.id === 'retry').length, 1);
  assert.equal(retried.employees.find((e:any) => e.id === 'retry').revision, 1);
  await rejected(mutate([save(employee('another'))],[],request), '22023');
  await mutate([save({...employee('second-admin','stranger@example.com'),role:'admin'})]);
  await db.query('select private.link_employee_account($1,$2)', ['second-admin',stranger]);
  await rejected(mutate(changes,[],request,stranger), '22023');
  const updateId = crypto.randomUUID();
  await mutate([save({...employee('retry'),first_name:'Changed'},1)],[],updateId);
  const updateRetry = await mutate([save({...employee('retry'),first_name:'Changed'},1)],[],updateId);
  assert.equal(updateRetry.employees.find((e:any) => e.id === 'retry').revision,2);
});
test('normalized email, contract dates and numeric bounds enforced', async () => {
  await rejected(mutate([save(employee('duplicate','member@example.com'))]), '23505');
  await rejected(mutate([save(employee('uppercase','UPPER@example.com'))]), '23514');
  await rejected(mutate([save({...employee('dates'),end_date:'2025-12-31'})]), '23514');
  await rejected(mutate([save({...employee('rate'),hourly_rate:-1})]), '23514');
});
test('own admin access and linked email cannot be changed; history prevents deletion', async () => {
  const me = (await snapshot()).employees.find((e:any) => e.id === adminId);
  const {revision,access_linked,updated_at,...record} = me;
  await rejected(mutate([save({...record,role:'employee'},revision)]), '42501');
  await rejected(mutate([save({...record,active:false},revision)]), '42501');
  await rejected(mutate([del(adminId,revision)]), '42501');
  await rejected(mutate([save({...employee('member'),email:'changed@example.com'},2)]), '22023');
  await rejected(mutate([del('member',2)]), '23001');
});
test('archiving revokes read access immediately; no new scheduling, historical notes still editable', async () => {
  await mutate([save({...employee('member'),active:false},2)]);
  await rejected(snapshot(member), '42501');
  assert.equal((await as('authenticated',member,()=>db.query('select * from public.employees'))).rows.length,0);
  assert.equal((await as('authenticated',member,()=>db.query('select * from public.shifts'))).rows.length,0);
  await rejected(mutate([],[save(shift('inactive-new','member','2026-11-01'))]), '23514');
  await rejected(mutate([],[save({...shift('night'),date:'2026-11-01'},2)]), '23514');
  const result = await mutate([],[save({...shift('night'),notes:'Historical note'},2)]);
  assert.equal(result.shifts.find((s:any)=>s.id==='night').notes,'Historical note');
});
