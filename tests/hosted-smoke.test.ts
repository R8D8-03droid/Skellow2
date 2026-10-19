import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('hosted SaaS recipe rolls back its fixtures on an occupied database', async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  const existingUser = '90000000-0000-4000-8000-000000000001';
  const existingVenue = '90000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to public;`);
    await db.exec(await readFile('supabase/migrations/202610160001_workspace.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/202610180001_restaurant_accounts.sql', 'utf8'));
    await db.query('insert into auth.users values ($1,$2,now(),$3)', [existingUser, 'existing@example.com', {}]);
    await db.exec('begin; set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [existingUser]);
    await db.query('select public.create_restaurant($1,$2)', [existingVenue, 'Déjà en service']);
    await db.exec('commit');

    await db.exec(await readFile('supabase/tests/hosted-smoke.sql', 'utf8'));

    const users = await db.query<{ count: number }>('select count(*)::integer as count from auth.users');
    const restaurants = await db.query<{ id: string; name: string }>('select id,name from public.restaurants');
    const invitations = await db.query<{ count: number }>('select count(*)::integer as count from private.invitations');
    assert.equal(users.rows[0].count, 1);
    assert.deepEqual(restaurants.rows, [{ id: existingVenue, name: 'Déjà en service' }]);
    assert.equal(invitations.rows[0].count, 0);
  } finally {
    await db.close();
  }
});
