import type { SupabaseClient } from "@supabase/supabase-js";
import { backendError, WorkspaceError, type Change, type WorkspaceChanges, type WorkspaceRepository } from "./contracts";
import { employeeRecord, shiftRecord, fromSnapshot } from "./mapping";

function serialize<T extends { id: string; revision?: number }>(changes: Change<T>[], record: (value: T) => unknown) {
  return changes.map(({ kind, value }) => kind === "save"
    ? { kind, data: record(value), expected_revision: value.revision ?? null }
    : { kind, id: value.id, expected_revision: value.revision ?? null });
}
export class SupabaseRepository implements WorkspaceRepository {
  readonly mode = "supabase";
  private pending = new Map<string, string>();
  constructor(private client: SupabaseClient) {}
  async load() {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw backendError(error);
    if (!session) return null;
    const verified = await this.client.auth.getUser();
    if (verified.error) throw backendError(verified.error);
    const result = await this.client.rpc("workspace_snapshot");
    if (result.error) throw backendError(result.error);
    return fromSnapshot(result.data);
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
    if (error) throw new WorkspaceError("La déconnexion n’a pas pu être entièrement confirmée. Vérifiez votre connexion puis réessayez.", "logout");
  }
  subscribe(listener: () => void) {
    let identity: string | null | undefined;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN can repeat on tab focus; only discard drafts on identity changes.
      // Never await SDK calls inside the auth lock.
      const next = session?.user.id || null;
      const changed = identity !== undefined && next !== identity;
      identity = next;
      if (changed || event === "SIGNED_OUT") this.pending.clear();
      if (changed || event === "SIGNED_OUT" || event === "USER_UPDATED") listener();
    });
    return () => data.subscription.unsubscribe();
  }
  async mutate(changes: WorkspaceChanges) {
    const args = { p_employee_changes: serialize(changes.employees || [], employeeRecord), p_shift_changes: serialize(changes.shifts || [], shiftRecord) };
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
