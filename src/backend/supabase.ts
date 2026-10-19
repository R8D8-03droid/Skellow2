import type { SupabaseClient } from "@supabase/supabase-js";
import { backendError, WorkspaceError, type Change, type WorkspaceChanges, type WorkspaceRepository } from "./contracts";
import { authRedirect, type RestaurantAccess, type MembershipRole } from "./account";
import { employeeRecord, shiftRecord, fromSnapshot } from "./mapping";

function serialize<T extends { id: string; revision?: number }>(changes: Change<T>[], record: (value: T) => unknown) {
  return changes.map(({ kind, value }) => kind === "save"
    ? { kind, data: record(value), expected_revision: value.revision ?? null }
    : { kind, id: value.id, expected_revision: value.revision ?? null });
}
export class SupabaseRepository implements WorkspaceRepository {
  readonly mode = "supabase";
  private restaurantId: string | null = null;
  private selectionVersion = 0;
  private identityVersion = 0;
  private pending = new Map<string, string>();
  constructor(private client: SupabaseClient, private authSettings?: {url: string; key: string}) {}
  private assertIdentity(version: number) {
    if (version !== this.identityVersion) throw new WorkspaceError('Votre session a changé pendant le chargement. Reconnectez-vous pour retrouver vos données.', 'session');
  }
  async load() {
    const selection = this.selectionVersion;
    const identity = this.identityVersion;
    const restaurantId = this.restaurantId;
    const { data: { session }, error } = await this.client.auth.getSession();
    this.assertIdentity(identity);
    if (error) throw backendError(error);
    if (!session) return null;
    const verified = await this.client.auth.getUser();
    this.assertIdentity(identity);
    if (verified.error) throw backendError(verified.error);
    if (!verified.data.user || verified.data.user.id !== session.user.id) throw new WorkspaceError('Votre session a changé pendant le chargement. Reconnectez-vous pour retrouver vos données.', 'session');
    const result = await this.client.rpc("workspace_snapshot", restaurantId ? { p_restaurant_id: restaurantId } : undefined);
    this.assertIdentity(identity);
    if (result.error) throw backendError(result.error);
    if (result.data?.account?.id && result.data.account.id !== session.user.id) throw new WorkspaceError('Votre session a changé pendant le chargement. Reconnectez-vous pour retrouver vos données.', 'session');
    const snapshot = fromSnapshot(result.data);
    if (selection === this.selectionVersion) this.restaurantId = snapshot.restaurantId || null;
    return snapshot;
  }
  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new WorkspaceError(error.status === 429
      ? "Trop de tentatives. Patientez quelques instants avant de réessayer."
      : error.status && error.status >= 500 || !error.status
        ? "Le service de connexion est indisponible. Réessayez dans un instant."
        : "L’adresse e-mail ou le mot de passe est incorrect, ou le compte n’est pas confirmé.", error.code);
  }
  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: "local" });
    this.pending.clear();
    this.selectRestaurant(null);
    if (error) throw new WorkspaceError("La déconnexion n’a pas pu être entièrement confirmée. Vérifiez votre connexion puis réessayez.", "logout");
  }
  subscribe(listener: (change?: { event: string; email?: string; authenticated?: boolean; identityChanged?: boolean }) => void) {
    let identity: string | null | undefined;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN can repeat on tab focus; only discard drafts on identity changes.
      // Never await SDK calls inside the auth lock.
      const next = session?.user.id || null;
      const changed = identity !== undefined && next !== identity;
      identity = next;
      if (changed || event === "SIGNED_OUT") { this.identityVersion++; this.pending.clear(); this.selectRestaurant(null); }
      if (changed || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") listener({ event, email: session?.user.email, authenticated: !!session, identityChanged: changed });
    });
    return () => data.subscription.unsubscribe();
  }
  selectRestaurant(id: string | null) { this.restaurantId = id; this.selectionVersion++; }
  private authError(error: { code?: string; status?: number }) {
    return new WorkspaceError(error.status === 429 ? "Trop de demandes. Réessayez dans quelques minutes." : "La demande n’a pas abouti. Vérifiez les informations et réessayez.", error.code);
  }
  async signUp(name: string, email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email: email.trim().toLowerCase(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: authRedirect() } });
    if (error) throw this.authError(error);
    return !!data.session;
  }
  async googleAvailable(): Promise<boolean> {
    if (!this.authSettings) return false;
    try {
      const response = await fetch(`${this.authSettings.url}/auth/v1/settings`, { headers: { apikey: this.authSettings.key } });
      if (!response.ok) return false;
      return (await response.json()).external?.google === true;
    } catch { return false; }
  }
  async signInGoogle() {
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } });
    if (error) throw this.authError(error);
  }
  async resetPassword(email: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirect(true) });
    if (error) throw this.authError(error);
  }
  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw this.authError(error);
  }
  async createRestaurant(id: string, name: string) {
    const identity = this.identityVersion;
    const { data, error } = await this.client.rpc('create_restaurant', { p_restaurant_id: id, p_name: name });
    if (error) throw backendError(error, true);
    if (identity !== this.identityVersion) throw new WorkspaceError('Votre session a changé. Reconnectez-vous pour retrouver votre établissement.', 'session');
    this.selectRestaurant(id);
    return fromSnapshot(data);
  }
  async acceptInvitation(token: string) {
    const identity = this.identityVersion;
    const { data, error } = await this.client.rpc('accept_invitation', { p_token: token });
    if (error) throw backendError(error, true);
    if (identity !== this.identityVersion) throw new WorkspaceError('Votre session a changé. Reconnectez-vous avant de reprendre l’invitation.', 'session');
    const snapshot = fromSnapshot(data);
    this.selectRestaurant(snapshot.restaurantId || null);
    return snapshot;
  }
  async access(restaurantId: string): Promise<RestaurantAccess> {
    const { data, error } = await this.client.rpc('restaurant_access', { p_restaurant_id: restaurantId });
    if (error) throw backendError(error);
    return data;
  }
  async invite(restaurantId: string, email: string, role: 'admin' | 'employee', employeeId: string | null, token: string) {
    const { error } = await this.client.rpc('create_invitation', { p_restaurant_id: restaurantId, p_email: email, p_role: role, p_employee_id: employeeId, p_token: token });
    if (error) throw backendError(error, true);
  }
  async revokeInvitation(restaurantId: string, id: string) {
    const { error } = await this.client.rpc('revoke_invitation', { p_restaurant_id: restaurantId, p_invitation_id: id });
    if (error) throw backendError(error, true);
  }
  async updateAccess(restaurantId: string, userId: string, role: MembershipRole, active: boolean, revision: number) {
    const { error } = await this.client.rpc('update_member_access', { p_restaurant_id: restaurantId, p_user_id: userId, p_role: role, p_active: active, p_revision: revision });
    if (error) throw backendError(error, true);
  }
  async mutate(changes: WorkspaceChanges) {
    const args = { ...(this.restaurantId ? { p_restaurant_id: this.restaurantId } : {}), p_employee_changes: serialize(changes.employees || [], value => employeeRecord({ ...value, role: "employee" })), p_shift_changes: serialize(changes.shifts || [], shiftRecord) };
    const fingerprint = JSON.stringify(args);
    const requestId = this.pending.get(fingerprint) || crypto.randomUUID();
    this.pending.set(fingerprint, requestId);
    const { data, error } = await this.client.rpc("apply_workspace_changes", { ...args, p_request_id: requestId });
    if (error) {
      // Keep the same receipt ID on transport/ambiguous errors; SQL rejection is definitive.
      if (error.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("PGRST")) this.pending.delete(fingerprint);
      throw backendError(error, true);
    }
    this.pending.delete(fingerprint);
    return fromSnapshot(data);
  }
}
