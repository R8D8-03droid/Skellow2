import { test, expect, type Page, type Route } from '@playwright/test';
import { member, service } from './fixtures';
import { employeeRecord, shiftRecord } from '../src/backend/mapping';

// These tests exercise the real SDK and UI against intercepted HTTP responses.
// Database authorization and constraints have separate PostgreSQL tests.
const storageKey = 'sb-mock-auth-token';
const authId = '10000000-0000-4000-8000-000000000001';
const user = { id: authId, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com',
  created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} };
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authId, exp, aud: 'authenticated', role: 'authenticated' })}.test`,
    token_type: 'bearer', refresh_token: 'test-refresh-token', expires_in: 3600, expires_at: exp, user };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: {
    'X-Supabase-Api-Version': '2024-01-01',
    'Access-Control-Expose-Headers': 'X-Supabase-Api-Version',
  }, body: JSON.stringify(body) });
}
async function mockBackend(page: Page, role: 'admin' | 'employee' = 'admin') {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const state = {
    employees: [
      { ...employeeRecord({ ...member('admin'), firstName: 'Alex', lastName: 'Dupont', role }), revision: 1, access_linked: true },
      { ...employeeRecord(member()), revision: 1, access_linked: true },
    ],
    shifts: [{ ...shiftRecord({ ...service(), employeeId: 'admin', date }), revision: 1 }],
    writes: [] as any[],
    receipts: new Set<string>(),
    expired: false,
    revoked: false,
    rejectLogin: false,
    rejectLogout: false,
    snapshotReads: 0,
    loginGate: null as ReturnType<typeof gate> | null,
    writeHandler: null as ((route: Route, payload: any) => Promise<void>) | null,
    snapshot() {
      const admin = this.employees[0].role === 'admin';
      return { current_employee_id: 'admin', employees: admin ? this.employees : this.employees.slice(0, 1),
        shifts: this.shifts.filter(s => admin || s.employee_id === 'admin') };
    },
    commit(payload: any) {
      if (this.receipts.has(payload.p_request_id)) return;
      for (const change of payload.p_employee_changes) {
        const index = this.employees.findIndex(e => e.id === (change.data?.id || change.id));
        if (change.kind === 'delete') this.employees.splice(index, 1);
        else if (index < 0) this.employees.push({ ...change.data, revision: 1, access_linked: false });
        else this.employees[index] = { ...this.employees[index], ...change.data, revision: this.employees[index].revision + 1 };
      }
      this.receipts.add(payload.p_request_id);
    },
  };
  await page.context().route('https://mock.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/token') {
      await state.loginGate?.promise;
      return state.rejectLogin ? json(route, { error: 'invalid_grant', code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400) : json(route, session());
    }
    if (path === '/auth/v1/user') return state.expired
      ? json(route, { code: 'session_not_found', msg: 'Session expired' }, 401) : json(route, user);
    if (path === '/auth/v1/logout') return state.rejectLogout
      ? json(route, { code: 'unexpected_failure', msg: 'Unavailable' }, 500) : json(route, {});
    if (path === '/rest/v1/rpc/workspace_snapshot') {
      state.snapshotReads++;
      return state.revoked ? json(route, { code: '42501', message: 'workspace_access_denied' }, 403) : json(route, state.snapshot());
    }
    if (path === '/rest/v1/rpc/apply_workspace_changes') {
      const payload = route.request().postDataJSON();
      state.writes.push(payload);
      if (state.writeHandler) return state.writeHandler(route, payload);
      state.commit(payload);
      return json(route, state.snapshot());
    }
    throw new Error(`Unexpected backend endpoint: ${path}`);
  });
  return state;
}
async function login(page: Page, role = 'admin') {
  await page.goto('/');
  await page.getByLabel('Adresse e-mail').fill('admin@example.com');
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: role === 'admin' ? 'Le planning, en harmonie.' : 'Votre planning.' })).toBeVisible();
}
async function newMember(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Équipe/ }).click();
  await page.getByRole('button', { name: 'Ajouter un membre', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of [['Prénom', 'Camille'], ['Nom', 'Test'], ['Adresse e-mail', 'camille@example.com'], ['Poste', 'Bar']]) {
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  return dialog;
}
async function broadcast(page: Page, event: string, clear = false) {
  await page.evaluate(({ key, event, clear }) => {
    const current = JSON.parse(localStorage.getItem(key) || 'null');
    if (clear) localStorage.removeItem(key);
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event, session: clear ? null : current });
    channel.close();
  }, { key: storageKey, event, clear });
}

test('connected login has no demo seed; errors preserve input and pending login locks controls', async ({ page }) => {
  const state = await mockBackend(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Administrateur', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hotel_employees'))).toBeNull();
  await page.getByLabel('Adresse e-mail').fill('admin@example.com');
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password');
  state.rejectLogin = true;
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue('admin@example.com');
  state.rejectLogin = false;
  state.loginGate = gate();
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByLabel('Adresse e-mail')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connexion…', exact: true })).toBeDisabled();
  state.loginGate.release();
  await expect(page.getByRole('heading', { name: 'Le planning, en harmonie.' })).toBeVisible();
});

test('slow and rejected saves preserve the draft and never confirm success', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  const dialog = await newMember(page);
  const pending = gate();
  state.writeHandler = async route => { await pending.promise; await json(route, { code: '23514', message: 'invalid_data' }, 400); };
  await dialog.getByRole('button', { name: 'Ajouter le membre', exact: true }).click();
  await expect(dialog.getByLabel('Prénom', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  expect(state.writes).toHaveLength(1);
  pending.release();
  await expect(dialog.getByRole('alert')).toContainText('invalides');
  await expect(dialog.getByLabel('Prénom', { exact: true })).toHaveValue('Camille');
  await expect(page.getByText('La fiche du membre a été enregistrée.', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
});

test('a lost write response retries the same receipt without duplicating the member', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  const dialog = await newMember(page);
  state.writeHandler = async (route, payload) => {
    state.commit(payload);
    if (state.writes.length === 1) await json(route, { message: 'Response lost' }, 503);
    else await json(route, state.snapshot());
  };
  await dialog.getByRole('button', { name: 'Ajouter le membre', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('non confirmée');
  await dialog.getByRole('button', { name: 'Ajouter le membre', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.employees.filter(e => e.email === 'camille@example.com')).toHaveLength(1);
  expect(state.writes[0].p_employee_changes[0].expected_revision).toBeNull();
  for (const field of ['password', 'auth_user_id', 'revision']) expect(state.writes[0].p_employee_changes[0].data).not.toHaveProperty(field);
});

test('refresh and repeated SIGNED_IN preserve draft revision; stale writes require reopening', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  await page.getByRole('navigation').getByRole('button', { name: /Équipe/ }).click();
  await page.getByRole('button', { name: 'Julie Martin', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Prénom', { exact: true }).fill('Brouillon');
  state.employees[1].revision = 2;
  state.employees[1].first_name = 'Version distante';
  const reads = state.snapshotReads;
  await broadcast(page, 'SIGNED_IN');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.snapshotReads).toBeGreaterThan(reads);
  await expect(dialog.getByLabel('Prénom', { exact: true })).toHaveValue('Brouillon');
  state.writeHandler = route => json(route, { code: '40001', message: 'stale_record' }, 400);
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changé entre-temps');
  expect(state.writes[0].p_employee_changes[0].expected_revision).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Version distante Martin', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Prénom', { exact: true })).toHaveValue('Version distante');
});

test('employee planning is personal and read-only, including an open editor after role downgrade', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  await page.locator('.shift-card').first().click();
  await expect(page.getByRole('dialog').getByLabel('Début', { exact: true })).toBeEnabled();
  state.employees[0].role = 'employee';
  const reads = state.snapshotReads;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.snapshotReads).toBeGreaterThan(reads);
  await expect(page.getByRole('heading', { name: 'Votre planning.' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('dialog').getByLabel('Début', { exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ajouter un service', exact: true })).toHaveCount(0);
  await expect(page.getByText('Julie Martin', { exact: true })).toHaveCount(0);
});

for (const reason of ['expired', 'revoked'] as const) {
  test(`${reason} access clears the private interface on refresh`, async ({ page }) => {
    const state = await mockBackend(page);
    await login(page);
    state[reason] = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    if (reason === 'expired') await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Votre espace est indisponible' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('.shift-card')).toHaveCount(0);
  });
}

test('logout in another tab during a save cannot resurrect the old session or show success', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  const dialog = await newMember(page);
  const pending = gate();
  state.writeHandler = async (route, payload) => { await pending.promise; state.commit(payload); await json(route, state.snapshot()); };
  await dialog.getByRole('button', { name: 'Ajouter le membre', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await broadcast(page, 'SIGNED_OUT', true);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  pending.release();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByText('La fiche du membre a été enregistrée.', { exact: true })).toHaveCount(0);
});

test('failed server logout still clears private data when the SDK removes its local session', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  state.rejectLogout = true;
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre espace est indisponible' })).toBeVisible();
  await expect(page.getByRole('alert').first()).toContainText('déconnexion');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('.shift-card')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
});

test('local import is explicit and strips old passwords and privileges without deleting source data', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  const legacy = [{ ...member('legacy'), firstName: 'Ancien', role: 'admin', password: 'legacy-secret', auth_user_id: 'forged' }];
  await page.evaluate(data => { localStorage.setItem('hotel_employees', JSON.stringify(data)); localStorage.setItem('hotel_shifts', '[]'); }, legacy);
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await page.getByRole('button', { name: 'Reprendre les données de cet appareil' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Reprendre les données locales' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog.getByText('Voir les données à importer').click();
  await expect(dialog).toContainText('Ancien Martin');
  await dialog.getByRole('button', { name: 'Importer ces données' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  const payload = state.writes[0].p_employee_changes[0];
  expect(payload.data.role).toBe('employee');
  expect(payload.expected_revision).toBeNull();
  expect(JSON.stringify(payload)).not.toContain('legacy-secret');
  expect(JSON.stringify(payload)).not.toContain('forged');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hotel_employees')!))).toEqual(legacy);
});
