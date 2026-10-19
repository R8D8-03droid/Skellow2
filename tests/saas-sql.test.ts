import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
const db = new PGlite({ extensions: { btree_gist } });
const owner = '10000000-0000-4000-8000-000000000001';
const staff = '10000000-0000-4000-8000-000000000002';
const outsider = '10000000-0000-4000-8000-000000000003';
const unconfirmed = '10000000-0000-4000-8000-000000000004';
const a = '20000000-0000-4000-8000-000000000001';
const b = '20000000-0000-4000-8000-000000000002';
const c = '20000000-0000-4000-8000-000000000003';
const d = '20000000-0000-4000-8000-000000000004';
const e = '20000000-0000-4000-8000-000000000005';
const token = (c: string) => c.repeat(64);
const employee = (id:string) => ({id, first_name:'Sam',last_name:'Test',email:`${id}@example.com`,phone:'',position:'Serveur',department:'Salle',contract_type:'CDI',start_date:'2026-01-01',end_date:null,hourly_rate:15,monthly_hours:151.67,social_security_number:'',address:'',postal_code:'',city:'',bank_rib:'',role:'employee',active:true,night_work:false});
const shift = (id:string, employee_id='staff') => ({id,employee_id,date:'2026-10-18',start_time:'19:00',end_time:'23:00',role:'Service',notes:'',status:'scheduled',is_night_shift:false});
const save = (data:object,expected_revision:number|null=null) => ({kind:'save',data,expected_revision});
async function as(uid:string|null,sql:string,args:any[]=[],role='authenticated') {
  await db.exec('begin');
  try { await db.exec(`set local role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid||'']); const r=await db.query<{v:any}>(sql,args); await db.exec('commit'); return r.rows[0]?.v; }
  catch(e) { await db.exec('rollback'); throw e; }
}
const snap = (uid=owner,venue:string|null=a) => as(uid,'select public.workspace_snapshot($1) v',[venue]);
const mutate = (venue:string,employees:any[]=[],shifts:any[]=[],uid=owner,request=crypto.randomUUID()) => as(uid,'select public.apply_workspace_changes($1,$2,$3::jsonb,$4::jsonb) v',[request,venue,JSON.stringify(employees),JSON.stringify(shifts)]);
const invite = (venue:string,t:string,role='employee',id:string|null='staff',email='staff@example.com',uid=owner) => as(uid,'select public.create_invitation($1,$2,$3,$4,$5) v',[venue,email,role,id,t]);
const accept = (t:string,uid=staff) => as(uid,'select public.accept_invitation($1) v',[t]);
const access = (uid=owner,venue=a) => as(uid,'select public.restaurant_access($1) v',[venue]);
async function rejects(p:Promise<any>,code:string) { await assert.rejects(p,(e:any)=>{assert.equal(e.code,code,e.message);return true;}); }
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to public;`);
  for(const [id,email] of [[owner,'owner@example.com'],[staff,'staff@example.com'],[outsider,'outsider@example.com'],[unconfirmed,'new@example.com']]) await db.query('insert into auth.users values ($1,$2,$3,$4)',[id,email,id===unconfirmed?null:new Date().toISOString(),{role:'owner'}]);
  await db.exec(await readFile('supabase/migrations/202610160001_workspace.sql','utf8'));
  // Exercise the in-place conversion, not only an empty installation.
  await db.query("select private.bootstrap_admin($1,'Owner','Legacy')",[owner]);
  await db.exec(await readFile('supabase/migrations/202610180001_restaurant_accounts.sql','utf8'));
});
after(()=>db.close());
test('a new installation can migrate before its first account or restaurant exists',async()=>{
  const fresh = new PGlite({ extensions: { btree_gist } });
  try {
    await fresh.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to public;`);
    await fresh.exec(await readFile('supabase/migrations/202610160001_workspace.sql','utf8'));
    await fresh.exec(await readFile('supabase/migrations/202610180001_restaurant_accounts.sql','utf8'));
    await fresh.query('insert into auth.users values ($1,$2,$3,$4)',[owner,'owner@example.com',new Date().toISOString(),{}]);
    await fresh.exec('begin');
    await fresh.exec('set local role authenticated');
    await fresh.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
    const before = await fresh.query<{v:any}>('select public.workspace_snapshot(null) v');
    assert.deepEqual(before.rows[0].v.restaurants,[]);
    const created = await fresh.query<{v:any}>('select public.create_restaurant($1,$2) v',[a,'Le Jardin']);
    assert.equal(created.rows[0].v.membership_role,'owner');
    assert.equal(created.rows[0].v.employees.length,0);
    await fresh.exec('commit');
  } finally { await fresh.close(); }
});
test('legacy conversion keeps staff and gives independent owner access',async()=>{
  const s=await snap(owner,null); assert.equal(s.membership_role,'owner'); assert.equal(s.current_employee_id,null); assert.equal(s.employees.length,1); assert.equal(s.employees[0].role,'employee'); assert.ok(!('auth_user_id' in s.employees[0]));
});
test('verified self-service onboarding is atomic and idempotent without payroll entries',async()=>{
  assert.equal((await snap(outsider,null)).restaurants.length,0);
  await rejects(as(unconfirmed,'select public.create_restaurant($1,$2) v',[a,'New']), '42501');
  for(let n=0;n<2;n++) { const s=await as(owner,'select public.create_restaurant($1,$2) v',[a,'Le Jardin']); assert.equal(s.employees.length,0); assert.equal(s.membership_role,'owner'); }
  await as(outsider,'select public.create_restaurant($1,$2) v',[b,'Autre restaurant']);
  await rejects(as(outsider,'select public.create_restaurant($1,$2) v',[a,'Le Jardin']),'42501');
});
test('same employee IDs and emails can exist in separate tenants; no read or write crosses tenants',async()=>{
  await mutate(a,[save(employee('staff')),save(employee('other'))],[save(shift('service'))]);
  await mutate(b,[save(employee('staff')),save(employee('only-b'))],[save(shift('service'))],outsider);
  await rejects(snap(owner,b),'42501'); await rejects(mutate(b,[],[],owner),'42501');
  await rejects(mutate(a,[],[save(shift('cross','only-b'))]),'23514');
  const ids=await as(owner,'select jsonb_agg(distinct restaurant_id) v from public.employees'); assert.ok(!ids.includes(b));
  await rejects(as(owner,"update public.memberships set role='owner' returning user_id v"),'42501');
  await rejects(as(null,'select public.workspace_snapshot($1) v',[a],'anon'),'42501');
  await rejects(mutate(a,[save({...employee('evil'),restaurant_id:b})]),'22023');
  await rejects(mutate(a,[save({...employee('evil'),role:'admin'})]),'22023');
});
test('invitations are verified-email bound, retryable, and expose no secret through listing',async()=>{
  await rejects(invite(a,token('9'),'admin','staff','staff@example.com'),'22023');
  const id=await invite(a,token('a')); assert.equal(await invite(a,token('a')),id);
  await rejects(accept(token('a'),outsider),'42501');
  await rejects(accept(token('a'),unconfirmed),'42501');
  const list=await access(); assert.ok(!JSON.stringify(list).includes('token_hash')); assert.ok(!JSON.stringify(list).includes(token('a')));
  const s=await accept(token('a')); assert.equal(s.membership_role,'employee'); assert.deepEqual(s.employees.map((e:any)=>e.id),['staff']); assert.equal(s.shifts.length,1);
  assert.equal((await accept(token('a'))).current_employee_id,'staff');
  await rejects(access(staff),'42501'); await rejects(mutate(a,[],[],staff),'42501');
  assert.equal(await as(staff,'select count(*)::int v from public.employees'),1);
});
test('one account joins two restaurants with independent permissions and data',async()=>{
  await invite(b,token('b'),'admin',null,'staff@example.com',outsider); const s=await accept(token('b'));
  assert.equal(s.restaurants.length,2); assert.equal(s.membership_role,'admin'); assert.equal(s.current_employee_id,null); assert.equal(s.employees.length,2);
  await mutate(b,[],[save({...shift('service'),notes:'Modified'},1)],staff);
  await rejects(invite(b,token('c'),'admin',null,'new@example.com',staff),'42501');
  assert.equal((await snap(owner,a)).shifts[0].notes,'');
});
test('changing a linked account email removes employee access until it matches again',async()=>{
  await db.query('update auth.users set email=$1 where id=$2',['changed@example.com',staff]);
  try {
    await rejects(snap(staff,a),'42501');
    assert.equal(await as(staff,'select count(*)::int v from public.employees'),2);
    assert.equal((await snap(staff,b)).membership_role,'admin');
    assert.equal((await access()).members.find((m:any)=>m.user_id===staff).available,false);
  } finally {
    await db.query('update auth.users set email=$1 where id=$2',['staff@example.com',staff]);
  }
  assert.equal((await snap(staff,a)).membership_role,'employee');
  assert.equal((await access()).members.find((m:any)=>m.user_id===staff).available,true);
});
test('receipts, stale revisions, overlap and transaction rollback survive tenant migration',async()=>{
  const r=crypto.randomUUID(); const changes=[save({...shift('service'),notes:'Once'},1)];
  await mutate(a,[],changes,owner,r); const s=await mutate(a,[],changes,owner,r); assert.equal(s.shifts[0].revision,2);
  await rejects(mutate(b,[],changes,outsider,r),'22023');
  await rejects(mutate(a,[],changes),'40001');
  await rejects(mutate(a,[save(employee('rollback'))],[save(shift('overlap'))]),'23P01');
  assert.ok(!(await snap()).employees.some((e:any)=>e.id==='rollback'));
});
test('revoked and expired invitations cannot be redeemed',async()=>{
  const id=await invite(a,token('d'),'admin',null,'outsider@example.com');
  await as(owner,'select public.revoke_invitation($1,$2) v',[a,id]); await rejects(accept(token('d'),outsider),'22023');
  await invite(a,token('e'),'admin',null,'outsider@example.com'); await db.query("update private.invitations set expires_at=now()-interval '1 second' where email='outsider@example.com'"); await rejects(accept(token('e'),outsider),'22023');
});
test('archiving a linked employee revokes only that restaurant, historical shifts remain',async()=>{
  await mutate(a,[save({...employee('staff'),active:false},1)]);
  await rejects(snap(staff,a),'42501'); assert.equal((await snap(staff,b)).membership_role,'admin');
  assert.equal((await snap()).shifts.length,1);
  await rejects(mutate(a,[],[save({...shift('extra'),date:'2026-10-19'})]),'23514');
});
test('last owner is protected; role changes use revisions; accepted link cannot restore revoked access',async()=>{
  await rejects(as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[a,owner,'admin',true,1]),'42501');
  await rejects(as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[a,staff,'employee',false,999]),'40001');
  await as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[a,staff,'employee',false,1]);
  await mutate(a,[save(employee('staff'),2)]); await rejects(accept(token('a')),'22023');
});
test('an unconfirmed second owner cannot be the only owner left',async()=>{
  await as(outsider,'select public.create_restaurant($1,$2) v',[c,'Troisième restaurant']);
  await db.query("insert into public.memberships(restaurant_id,user_id,role) values($1,$2,'owner')",[c,unconfirmed]);
  await rejects(as(outsider,'select public.update_member_access($1,$2,$3,$4,$5) v',[c,outsider,'admin',true,1]),'42501');
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[unconfirmed]);
  await as(outsider,'select public.update_member_access($1,$2,$3,$4,$5) v',[c,outsider,'admin',true,1]);
  assert.equal((await snap(unconfirmed,c)).membership_role,'owner');
});
test('a linked employee can become an owner, keep access when archived, then return to employee',async()=>{
  await as(owner,'select public.create_restaurant($1,$2) v',[d,'Quatrième restaurant']);
  await mutate(d,[save({...employee('linked'),email:'staff@example.com'})]);
  await invite(d,token('f'),'employee','linked');
  assert.equal((await accept(token('f'))).membership_role,'employee');
  await as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[d,staff,'owner',true,1]);
  await mutate(d,[save({...employee('linked'),email:'staff@example.com',active:false},1)]);
  const owned = await snap(staff,d);
  assert.equal(owned.membership_role,'owner');
  assert.equal(owned.current_employee_id,'linked');
  const promoted = (await access(owner,d)).members.find((m:any)=>m.user_id===staff);
  assert.equal(promoted.employee_id,'linked');
  assert.equal(promoted.available,true);
  await as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[d,staff,'employee',true,promoted.revision]);
  const demoted = (await access(owner,d)).members.find((m:any)=>m.user_id===staff);
  assert.equal(demoted.employee_id,'linked');
  assert.equal(demoted.available,false);
  await rejects(snap(staff,d),'42501');
  await mutate(d,[save({...employee('linked'),email:'staff@example.com'},2)]);
  assert.equal((await snap(staff,d)).membership_role,'employee');
});
test('a suspended membership reserves its staff record and is reactivated through access management',async()=>{
  await as(owner,'select public.create_restaurant($1,$2) v',[e,'Cinquième restaurant']);
  await mutate(e,[save(employee('staff'))]);
  await invite(e,token('1'));
  // A staff record might be linked after a link was created, before it is redeemed.
  await db.query("insert into public.memberships(restaurant_id,user_id,role,employee_id,active) values($1,$2,'employee','staff',false)",[e,outsider]);
  await rejects(accept(token('1')),'23505');
  await rejects(invite(e,token('2')),'23505');
  await rejects(invite(e,token('3'),'admin',null,'outsider@example.com'),'23505');
  const member = (await access(owner,e)).members.find((item:any)=>item.user_id===outsider);
  assert.equal(member.active,false);
  await as(owner,'select public.update_member_access($1,$2,$3,$4,$5) v',[e,outsider,'employee',true,member.revision]);
  assert.equal((await access(owner,e)).members.find((item:any)=>item.user_id===outsider).active,true);
});
