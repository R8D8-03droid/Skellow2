import { test, expect, type Page, type Route } from '@playwright/test';
import { member } from './fixtures';
import { employeeRecord } from '../src/backend/mapping';

const key = 'sb-mock-auth-token';
const id = '10000000-0000-4000-8000-000000000001';
const venueA = '20000000-0000-4000-8000-000000000001';
const venueB = '20000000-0000-4000-8000-000000000002';
const token = 'a'.repeat(64);
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'Camille Martin' } };
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp, aud: 'authenticated', role: 'authenticated' })}.test`,
    token_type: 'bearer', refresh_token: 'test-refresh-token', expires_in: 3600, expires_at: exp, user };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: { 'X-Supabase-Api-Version': '2024-01-01' }, body: JSON.stringify(body) });
}
type Venue = { id: string; name: string; role: 'owner' | 'admin' | 'employee' };
async function backend(page: Page, venues: Venue[] = []) {
  const state = {
    venues,
    google: false,
    instantSignup: false,
    calls: [] as { name: string; args: any; url: string }[],
    inviteError: '',
    createGate: null as ReturnType<typeof gate> | null,
    loseCreateResponse: false,
    invitations: [] as any[],
    members: [{ user_id: id, email: user.email, role: 'owner', employee_id: null, active: true, available: true, revision: 1 }],
    snapshot(venueId?: string) {
      const venue = this.venues.find(v => v.id === venueId) || this.venues[0];
      return { account: { id, email: user.email, name: user.user_metadata.full_name }, restaurants: this.venues,
        restaurant_id: venue?.id || null, membership_role: venue?.role || null,
        current_employee_id: venue?.role === 'employee' ? 'staff' : null,
        employees: venue ? [{ ...employeeRecord({ ...member('staff'), firstName: venue.id === venueB ? 'Autre' : 'Julie' }), revision: 1, access_linked: false }] : [], shifts: [] };
    },
  };
  await page.context().route('https://mock.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').pop()!;
    const args = route.request().postData() ? route.request().postDataJSON() : null;
    state.calls.push({ name, args, url: url.toString() });
    switch (name) {
      case 'settings': return json(route, { external: { google: state.google }, disable_signup: false });
      case 'token': return json(route, session());
      case 'user': return json(route, user);
      case 'signup': return json(route, state.instantSignup ? session() : { ...user, email_confirmed_at: null, identities: [{ provider: 'email' }] });
      case 'recover': case 'logout': return json(route, {});
      case 'authorize': return route.fulfill({ contentType: 'text/html', body: '<p>Google OAuth test</p>' });
      case 'workspace_snapshot': return json(route, state.snapshot(args?.p_restaurant_id));
      case 'create_restaurant': {
        await state.createGate?.promise;
        if (!state.venues.some(v => v.id === args.p_restaurant_id)) state.venues.push({ id: args.p_restaurant_id, name: args.p_name, role: 'owner' });
        if (state.loseCreateResponse) { state.loseCreateResponse = false; return json(route, { message: 'Response lost' }, 503); }
        return json(route, state.snapshot(args.p_restaurant_id));
      }
      case 'accept_invitation': {
        if (state.inviteError) return json(route, { code: '42501', message: state.inviteError }, 403);
        if (!state.venues.length) state.venues.push({ id: venueA, name: 'Le Jardin', role: 'employee' });
        return json(route, state.snapshot());
      }
      case 'restaurant_access': return json(route, { members: state.members, invitations: state.invitations });
      case 'create_invitation': {
        state.invitations = [{ id: 'invitation-1', email: args.p_email, role: args.p_role, employee_id: args.p_employee_id, expires_at: new Date(Date.now() + 604800000).toISOString() }];
        return json(route, 'invitation-1');
      }
      case 'revoke_invitation': state.invitations = []; return json(route, null);
      case 'update_member_access': return json(route, { code: '42501', message: 'last_owner' }, 403);
      default: throw new Error(`Unexpected SaaS endpoint: ${name}`);
    }
  });
  return state;
}
async function signIn(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
}
async function signOutElsewhere(page: Page) {
  await page.evaluate(key => {
    localStorage.removeItem(key);
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: 'SIGNED_OUT', session: null }); channel.close();
  }, key);
}
const ownerVenue: Venue = { id: venueA, name: 'Le Jardin', role: 'owner' };

test('email signup waits for confirmation and preserves the invitation across the email callback', async ({ page }) => {
  const state = await backend(page);
  await page.goto(`/?invite=${token}`);
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Votre nom').fill('Camille Martin');
  await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('e-mail de confirmation');
  expect(state.calls.filter(c => c.url.includes('/rest/'))).toHaveLength(0);
  const signup = state.calls.find(c => c.name === 'signup')!;
  expect(new URL(new URL(signup.url).searchParams.get('redirect_to')!).searchParams.get('invite')).toBe(token);
  expect(page.url()).not.toContain(token);
  expect(await page.evaluate(() => sessionStorage.getItem('skellow:pending-invitation'))).toBe(token);
  expect(await page.getByLabel('Mot de passe', { exact: true }).inputValue()).toBe('');
});

test('new account creates its restaurant, retries a lost response with the same ID and gets independent owner access', async ({ page }) => {
  const state = await backend(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Bienvenue chez vous.' })).toBeVisible();
  await page.getByLabel('Nom de l’établissement').fill('   ');
  await page.getByRole('button', { name: 'Créer mon établissement' }).click();
  await expect(page.getByRole('alert')).toContainText('au moins deux');
  expect(state.calls.filter(c => c.name === 'create_restaurant')).toHaveLength(0);
  await page.getByLabel('Nom de l’établissement').fill('Le Jardin');
  state.loseCreateResponse = true;
  await page.getByRole('button', { name: 'Créer mon établissement' }).click();
  await expect(page.getByRole('alert')).toContainText('non confirmée');
  await page.getByRole('button', { name: 'Créer mon établissement' }).click();
  await expect(page.getByRole('heading', { name: 'Le planning, en harmonie.' })).toBeVisible();
  const creates = state.calls.filter(c => c.name === 'create_restaurant');
  expect(creates).toHaveLength(2); expect(creates[0].args).toEqual(creates[1].args);
  expect(state.calls.filter(c => c.name === 'apply_workspace_changes')).toHaveLength(0);
  await expect(page.getByRole('navigation').getByRole('button', { name: /Accès/ })).toBeVisible();
});

test('signup can also handle an immediately authenticated session', async ({ page }) => {
  const state = await backend(page); state.instantSignup = true;
  await page.goto('/'); await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Votre nom').fill('Camille Martin'); await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue chez vous.' })).toBeVisible();
});

test('wrong-email invitation gives a useful error; acceptance opens only employee views and clears the token', async ({ page }) => {
  const state = await backend(page); state.inviteError = 'invitation_email_mismatch';
  await signIn(page, `/?invite=${token}`);
  await page.getByRole('button', { name: 'Rejoindre l’établissement' }).click();
  await expect(page.getByRole('alert')).toContainText('autre adresse');
  expect(await page.evaluate(() => sessionStorage.getItem('skellow:pending-invitation'))).toBe(token);
  state.inviteError = '';
  await page.getByRole('button', { name: 'Rejoindre l’établissement' }).click();
  await expect(page.getByRole('heading', { name: 'Votre planning.' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button', { name: /Accès|Équipe/ })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('skellow:pending-invitation'))).toBeNull();
});

test('venue switching discards old editors and replaces staff and permissions', async ({ page }) => {
  await backend(page, [ownerVenue, { id: venueB, name: 'La Terrasse', role: 'admin' }]);
  await signIn(page);
  await page.getByRole('navigation').getByRole('button', { name: /Équipe/ }).click();
  await page.getByRole('button', { name: 'Julie Martin', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Prénom', { exact: true }).fill('Brouillon');
  await page.keyboard.press('Escape');
  await page.getByLabel('Établissement', { exact: true }).selectOption(venueB);
  await expect(page.getByRole('button', { name: 'Autre Martin', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Julie Martin', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button', { name: /Accès/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Autre Martin', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Prénom', { exact: true })).toHaveValue('Autre');
});

test('owner renews and revokes a shareable invitation; each new link gets a fresh token; last-owner protection is explained', async ({ page }) => {
  const state = await backend(page, [ownerVenue]);
  await signIn(page); await page.getByRole('navigation').getByRole('button', { name: /Accès/ }).click();
  await page.getByRole('button', { name: 'Inviter une personne' }).click();
  await page.getByLabel('Fiche salarié').selectOption('staff');
  await page.getByRole('button', { name: 'Créer le lien d’invitation' }).click();
  const link = await page.getByLabel('Lien à partager').inputValue();
  expect(new URL(link).searchParams.get('invite')).toMatch(/^[a-f0-9]{64}$/);
  expect(state.calls.find(c => c.name === 'create_invitation')?.args.p_email).toBe('staff@example.com');
  await page.getByRole('button', { name: 'Créer le lien d’invitation' }).click();
  await expect(page.getByLabel('Lien à partager')).not.toHaveValue(link);
  expect(state.calls.filter(c => c.name === 'create_invitation').map(c => c.args.p_token)).toHaveLength(2);
  const renewedLink = await page.getByLabel('Lien à partager').inputValue();
  await page.getByRole('button', { name: 'Révoquer l’invitation' }).click();
  await expect(page.getByLabel('Lien à partager')).toHaveCount(0);
  await page.getByRole('button', { name: 'Créer le lien d’invitation' }).click();
  await expect(page.getByLabel('Lien à partager')).not.toHaveValue(renewedLink);
  await page.getByLabel('Rôle de owner@example.com').selectOption('admin');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('au moins un propriétaire');
});

test('a suspended account keeps its staff record out of new invitations', async ({ page }) => {
  const state = await backend(page, [ownerVenue]);
  state.members.push({ user_id: '10000000-0000-4000-8000-000000000002', email: 'staff@example.com', role: 'employee', employee_id: 'staff', active: false, available: false, revision: 2 });
  await signIn(page);
  await page.getByRole('navigation').getByRole('button', { name: /Accès/ }).click();
  await page.getByRole('button', { name: 'Inviter une personne' }).click();
  await expect(page.getByLabel('Fiche salarié').locator('option')).toHaveCount(1);
  await expect(page.getByText('Toutes les fiches actives sont déjà liées à un compte.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer le lien d’invitation' })).toBeDisabled();
  expect(state.calls.some(call => call.name === 'create_invitation')).toBe(false);
});

test('logout elsewhere during restaurant creation cannot reopen the private interface', async ({ page }) => {
  const state = await backend(page); state.createGate = gate();
  await signIn(page); await page.getByLabel('Nom de l’établissement').fill('Le Jardin');
  await page.getByRole('button', { name: 'Créer mon établissement' }).click();
  await expect.poll(() => state.calls.filter(c => c.name === 'create_restaurant').length).toBe(1);
  await signOutElsewhere(page); state.createGate.release();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('password recovery accepts a valid Auth callback and handles expired links without a password form', async ({ page }) => {
  const state = await backend(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Bienvenue chez vous.' })).toBeVisible();
  await page.goto('/?flow=recovery#error=access_denied&error_code=otp_expired');
  await expect(page.getByRole('heading', { name: 'Retrouvons votre accès.' })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
  await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByRole('button', { name: 'Recevoir le lien' }).click();
  await expect(page.getByRole('status')).toContainText('recevrez un lien');
  const auth = session();
  const hash = new URLSearchParams({ access_token: auth.access_token, refresh_token: auth.refresh_token, token_type: 'bearer', expires_in: '3600', type: 'recovery' });
  const recoveryPage = await page.context().newPage();
  await recoveryPage.goto(`/?flow=recovery#${hash}`);
  await expect(recoveryPage.getByRole('heading', { name: 'Un nouveau départ.' })).toBeVisible();
  await recoveryPage.getByLabel('Mot de passe', { exact: true }).fill('synthetic-new-password');
  await recoveryPage.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(recoveryPage.getByRole('heading', { name: 'Bienvenue chez vous.' })).toBeVisible();
  expect(state.calls.some(c => c.name === 'user' && c.args?.password === 'synthetic-new-password')).toBe(true);
  expect(recoveryPage.url()).not.toContain('recovery');
});

test('Google appears only when configured and carries the pending invitation into the callback', async ({ page }) => {
  const state = await backend(page);
  await page.goto('/'); await expect(page.getByRole('button', { name: /Continuer avec Google/ })).toHaveCount(0);
  state.google = true;
  await page.goto(`/?invite=${token}`);
  await page.getByRole('button', { name: /Continuer avec Google/ }).click();
  await expect(page).toHaveURL(/auth\/v1\/authorize/);
  const url = new URL(page.url()); expect(url.searchParams.get('provider')).toBe('google');
  expect(new URL(url.searchParams.get('redirect_to')!).searchParams.get('invite')).toBe(token);
});

test('SaaS screens fit desktop and mobile, with usable touch controls', async ({ page }) => {
  const state = await backend(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Bienvenue chez vous.' })).toBeVisible();
  for (const [name, width, height] of [['desktop', 1440, 1050], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `.context/saas-welcome-${name}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  state.venues.push(ownerVenue);
  await page.reload(); await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('navigation').getByRole('button', { name: /Accès/ }).click();
  await page.getByRole('button', { name: 'Inviter une personne' }).click();
  await page.getByLabel('Fiche salarié').selectOption('staff');
  for (const [name, width, height] of [['desktop', 1440, 1050], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `.context/saas-access-${name}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
