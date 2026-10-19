import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readBackendConfig } from '../src/backend/config';
import { backendError, WorkspaceError } from '../src/backend/contracts';
import { employeeRecord, shiftRecord, fromSnapshot } from '../src/backend/mapping';
import { prepareImport } from '../src/backend/localImport';
import { SupabaseRepository } from '../src/backend/supabase';
import { member, service, serverSnapshot } from './fixtures';

test('connected configuration fails closed; only public keys and secure URLs are accepted', () => {
  assert.equal(readBackendConfig({}).mode, 'demo');
  assert.equal(readBackendConfig({ VITE_DATA_MODE: 'supabase' }).mode, 'error');
  assert.equal(readBackendConfig({ VITE_SUPABASE_URL: 'https://test.supabase.co' }).mode, 'error');
  const env = { VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.equal(readBackendConfig(env).mode, 'supabase');
  assert.equal(readBackendConfig({ ...env, VITE_SUPABASE_URL: 'http://example.com' }).mode, 'error');
  assert.equal(readBackendConfig({ ...env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).mode, 'supabase');
  for (const role of ['anon', 'service_role', 'authenticated']) {
    const key = `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
    assert.equal(readBackendConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:key}).mode, role === 'anon' ? 'supabase' : 'error');
  }
  assert.equal(readBackendConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_private'}).mode,'error');
});
test('explicit field mappings exclude credentials, auth IDs and writable revision overrides', () => {
  const e = employeeRecord({...member(), email:'  MEMBER@EXAMPLE.COM ', password:'old-password', auth_user_id:'spoof', revision:99} as any);
  assert.equal(e.email,'member@example.com');
  for (const key of ['password','auth_user_id','revision']) assert.ok(!(key in e));
  const s = shiftRecord({...service(),revision:20,slot:'forged'} as any);
  assert.ok(!('revision' in s) && !('slot' in s));
  const snapshot = fromSnapshot({...serverSnapshot(), employees: [{...serverSnapshot().employees[0],auth_user_id:'hidden'}] } as any);
  assert.ok(!('auth_user_id' in snapshot.employees[0]));
});
test('import matches existing email, preserves shared records, remaps services and never transfers privileges', () => {
  const shared = {...member('shared'),email:'member@example.com',role:'admin' as const,revision:8};
  const snapshot = {currentEmployeeId:'shared',employees:[shared],shifts:[]};
  const raw = {...member('new'), role:'admin',password:'secret',auth_user_id:'forged',revision:300};
  const preview = prepareImport([member(),raw],[service()],snapshot);
  assert.equal(preview.matched,1);
  assert.equal(preview.services[0].employeeId,'shared');
  assert.equal(preview.members[0].role,'employee');
  assert.equal(preview.members[0].revision,undefined);
  assert.equal(preview.members[0].accessLinked,false);
  assert.equal(preview.changes.employees?.length,1);
  assert.ok(!JSON.stringify(preview).includes('secret') && !JSON.stringify(preview).includes('forged'));
  assert.equal(shared.revision,8);
});
test('import rejects collisions, missing references, malformed data and oversized batches', () => {
  const empty = {currentEmployeeId:'admin',employees:[],shifts:[]};
  for (const [people, shifts, snapshot] of [
    [null,[],empty], [[{}],[],empty], [[member(),member()],[],empty],
    [[member()], [service(),service()], empty], [[],[service()],empty],
    [[member()],[],{...empty,employees:[{...member(),email:'another@example.com'}]}],
    [[member()],[service()],{...empty,shifts:[{...service(),notes:'changed'}]}],
    [Array.from({length:501},(_,i)=>member(`member-${i}`)),[],empty],
  ]) assert.throws(()=>prepareImport(people,shifts,snapshot as any),WorkspaceError);
});
test('import skips identical services and rejects newly imported services for archived members', () => {
  const snapshot = {currentEmployeeId:'admin',employees:[{...member(),active:false}],shifts:[service()]};
  const preview = prepareImport([member()],[service()],snapshot);
  assert.equal(preview.skipped,1); assert.equal(preview.services.length,0);
  assert.throws(()=>prepareImport([member()],[service('new')],snapshot),/archivé/);
});
test('safe errors distinguish historical restriction, expired sessions and stale records', () => {
  assert.match(backendError({code:'23001'}).message,/historique/);
  assert.equal(backendError({code:'PGRST301'}).code,'session');
  assert.equal(backendError({name:'AuthSessionMissingError',status:400}).code,'session');
  assert.equal(backendError({status:401}).code,'session');
  assert.equal(backendError({status:403}).code,'session');
  assert.notEqual(backendError({status:503}).code,'session');
  assert.equal(backendError({code:'42501',status:403}).code,'42501');
  assert.match(backendError({code:'40001'}).message,/dernière version/);
  assert.ok(!backendError({message:'private database details'},true).message.includes('private'));
});

function fakeClient() {
  const calls: {name:string; args:any}[] = [];
  let authListener: (event:string,session:any)=>void = () => {};
  let response: any = { data: serverSnapshot(), error: null };
  let authError: any = null;
  let signedIn = true;
  let userId = 'auth-admin';
  let rpcGate: Promise<void> | null = null;
  let rpcEntered: (() => void) | null = null;
  const client = {
    auth: {
      getSession: async () => ({data:{session: signedIn ? {user:{id:'auth-admin'}} : null},error:null}),
      getUser: async () => ({data:{user:{id:userId}},error:authError}),
      signInWithPassword: async (args:any) => { calls.push({name:'signIn',args}); return {error:authError}; },
      signOut: async () => ({error:authError}),
      onAuthStateChange: (listener:typeof authListener) => { authListener=listener; return {data:{subscription:{unsubscribe:()=>{}}}}; },
    },
    rpc: async (name:string,args:any) => {calls.push({name,args}); rpcEntered?.(); if (rpcGate) await rpcGate; return response;},
  };
  return { repo:new SupabaseRepository(client as unknown as SupabaseClient), calls,
    respond:(next:any)=>{response=next;}, authError:(error:any)=>{authError=error;},
    loggedOut:()=>{signedIn=false;}, setUserId:(id:string)=>{userId=id;},
    holdRpc:()=>{ let enter!:()=>void; let release!:()=>void; const started=new Promise<void>(resolve=>{enter=resolve;}); rpcGate=new Promise<void>(resolve=>{release=resolve;}); rpcEntered=enter; return {started,release}; },
    emit:(event:string,id:string|null)=>authListener(event,id?{user:{id}}:null) };
}
test('repository verifies sessions before reading; unauthenticated loads never call business RPCs', async () => {
  const f=fakeClient(); f.loggedOut(); assert.equal(await f.repo.load(),null); assert.equal(f.calls.length,0);
  const g=fakeClient(); g.authError({code:'session_not_found'});
  await assert.rejects(g.repo.load(),(e:any)=>e.code==='session'); assert.equal(g.calls.length,0);
});
test('repository rejects mismatched Auth identities before reading business data', async () => {
  const f=fakeClient(); f.setUserId('other-account');
  await assert.rejects(f.repo.load(),(e:any)=>e.code==='session');
  assert.equal(f.calls.length,0);
});
test('a delayed snapshot cannot restore the previous account after an Auth change', async () => {
  const f=fakeClient(); f.repo.subscribe(()=>{}); f.emit('INITIAL_SESSION','auth-admin');
  const gate=f.holdRpc();
  const loading=f.repo.load();
  await gate.started;
  f.emit('SIGNED_IN','other-account');
  gate.release();
  await assert.rejects(loading,(e:any)=>e.code==='session');
});
test('login errors are actionable and passwords are sent only to Auth', async () => {
  const f=fakeClient(); f.authError({status:400,code:'invalid_credentials'});
  await assert.rejects(f.repo.signIn(' MEMBER@EXAMPLE.COM ','secret'),/incorrect/);
  assert.deepEqual(f.calls,[{name:'signIn',args:{email:'member@example.com',password:'secret'}}]);
  f.authError({status:429}); await assert.rejects(f.repo.signIn('a','b'),/Trop de tentatives/);
});
test('ambiguous write retries retain UUID and expected revision, SQL rejections start a fresh attempt', async () => {
  const f=fakeClient(); const changes={shifts:[{kind:'save' as const,value:{...service(),revision:4}}]};
  f.respond({data:null,error:{message:'Failed to fetch',code:''}});
  await assert.rejects(f.repo.mutate(changes),/non confirmée/);
  const first=f.calls[0].args;
  assert.equal(first.p_shift_changes[0].expected_revision,4);
  assert.ok(!('revision' in first.p_shift_changes[0].data));
  f.respond({data:serverSnapshot(),error:null}); await f.repo.mutate(changes);
  assert.equal(f.calls[1].args.p_request_id,first.p_request_id);
  f.respond({data:null,error:{code:'40001'}}); await assert.rejects(f.repo.mutate(changes));
  f.respond({data:serverSnapshot(),error:null}); await f.repo.mutate(changes);
  assert.notEqual(f.calls[2].args.p_request_id,f.calls[3].args.p_request_id);
});
test('auth focus events preserve drafts, identity changes clear retry receipts and notify', async () => {
  const f=fakeClient(); let count=0; f.repo.subscribe(()=>count++);
  f.emit('INITIAL_SESSION','first'); f.emit('SIGNED_IN','first'); f.emit('TOKEN_REFRESHED','first');
  assert.equal(count,0);
  const changes={employees:[{kind:'save' as const,value:member()}]};
  f.respond({error:{code:'',message:'network'}}); await assert.rejects(f.repo.mutate(changes));
  f.emit('SIGNED_IN','second'); assert.equal(count,1);
  f.respond({data:serverSnapshot(),error:null}); await f.repo.mutate(changes);
  assert.notEqual(f.calls[0].args.p_request_id,f.calls[1].args.p_request_id);
  f.emit('SIGNED_OUT',null); assert.equal(count,2);
});
