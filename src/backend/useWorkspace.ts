import { useCallback, useEffect, useRef, useState } from "react";
import { clearInvitation, readInvitation } from "./account";
import { repository, accountRepository } from "./runtime";
import { errorMessage, WorkspaceError, type WorkspaceChanges, type WorkspaceSnapshot } from "./contracts";

export function useWorkspace() {
  const [invitation, setInvitation] = useState(readInvitation);
  const [recoveryRequested, setRecoveryRequested] = useState(() => new URLSearchParams(location.search).get('flow') === 'recovery' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery');
  // A recovery URL alone is not proof of a valid token: an expired link can
  // leave an older, unrelated Auth session in the browser.
  const [recovery, setRecovery] = useState(false);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);
  const controlledAuth = useRef<"signIn" | "signOut" | null>(null);
  const expectedEmail = useRef<string>();
  const mounted = useRef(true);
  const reload = useCallback(async () => {
    if (!repository) { setLoading(false); return; }
    if (busy.current) return;
    const request = ++generation.current;
    setRefreshing(true);
    try {
      const next = await repository.load();
      if (!mounted.current || request !== generation.current) return;
      setSnapshot(next); setError("");
    } catch (cause) {
      if (!mounted.current || request !== generation.current) return;
      if (cause instanceof WorkspaceError && ["42501", "session"].includes(cause.code)) { setSnapshot(null); accountRepository?.selectRestaurant(null); }
      setError(errorMessage(cause));
    } finally {
      if (mounted.current && request === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void reload();
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = repository?.subscribe(change => {
      if (controlledAuth.current === "signIn" && (!change || (change.event === 'SIGNED_IN' && change.email?.toLowerCase() === expectedEmail.current))) return;
      if (change?.event === 'USER_UPDATED') {
        clearTimeout(timer); timer = setTimeout(() => void reload(), 0);
        return;
      }
      if (change?.event === 'PASSWORD_RECOVERY' && change.authenticated) {
        setRecoveryRequested(true);
        setRecovery(true);
      } else if (change?.event === 'SIGNED_OUT' || (change?.event === 'SIGNED_IN' && change.identityChanged)) {
        setRecovery(false);
      }
      ++generation.current;
      // Immediately discard data when the identity changes in another tab.
      // signOut may remove the SDK session even when server revocation fails.
      setSnapshot(null);
      if (controlledAuth.current === "signOut") return;
      setLoading(true);
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 0);
    });
    const refreshVisible = () => { if (document.visibilityState === "visible") void reload(); };
    const interval = setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("online", refreshVisible);
    return () => {
      mounted.current = false; ++generation.current; unsubscribe?.(); clearTimeout(timer); clearInterval(interval);
      window.removeEventListener("focus", refreshVisible); window.removeEventListener("online", refreshVisible);
    };
  }, [reload]);
  const signIn = async (email: string, password: string) => {
    if (!repository) return;
    if (busy.current) throw new WorkspaceError("Une opération est déjà en cours. Patientez un instant.");
    busy.current = true;
    controlledAuth.current = "signIn";
    expectedEmail.current = email.trim().toLowerCase();
    const request = ++generation.current;
    try {
      await repository.signIn(email, password);
      const next = await repository.load();
      if (!next) throw new WorkspaceError("La session n’a pas pu être ouverte. Réessayez.");
      if (request !== generation.current) throw new WorkspaceError('Votre session a changé pendant la connexion. Réessayez.', 'session');
      if (mounted.current && request === generation.current) { setSnapshot(next); setError(""); setLoading(false); }
    } finally {
      busy.current = false; controlledAuth.current = null;
      if (mounted.current) { setRefreshing(false); if (request !== generation.current) void reload(); }
    }
  };
  const signOut = async () => {
    if (!repository) return;
    if (busy.current) throw new WorkspaceError("Patientez jusqu’à la fin de la sauvegarde avant de vous déconnecter.");
    busy.current = true;
    controlledAuth.current = "signOut";
    ++generation.current;
    try {
      await repository.signOut();
      if (mounted.current) { setSnapshot(null); setError(""); setLoading(false); }
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
      throw cause;
    } finally {
      busy.current = false; controlledAuth.current = null;
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  };
  const mutate = async (changes: WorkspaceChanges, demoPassword?: string) => {
    if (!repository || !snapshot) throw new WorkspaceError("Reconnectez-vous pour enregistrer vos modifications.");
    if (busy.current) throw new WorkspaceError("Une sauvegarde est déjà en cours. Patientez un instant.");
    busy.current = true; setSaving(true); setRefreshing(false);
    const request = ++generation.current;
    try {
      const next = await repository.mutate(changes, demoPassword);
      if (!mounted.current || request !== generation.current) throw new WorkspaceError("Votre session a changé pendant l’enregistrement. Reconnectez-vous pour vérifier le résultat.", "session");
      if (mounted.current && request === generation.current) { setSnapshot(next); setError(""); }
    } catch (cause) {
      if (mounted.current && request === generation.current) setError(errorMessage(cause));
      throw cause;
    } finally {
      busy.current = false; if (mounted.current) setSaving(false);
      // Refresh after both success and rejection: stale editors keep their own
      // revisions while the list receives the current server state.
      if (mounted.current) void reload();
    }
  };
  const accountAction = async (action: () => Promise<unknown>, signUpEmail?: string) => {
    if (busy.current) throw new WorkspaceError("Une opération est déjà en cours. Patientez un instant.");
    busy.current = true; controlledAuth.current = signUpEmail ? 'signIn' : null;
    expectedEmail.current = signUpEmail?.trim().toLowerCase(); setSaving(true);
    const request = ++generation.current;
    try {
      const result = await action();
      if (!mounted.current || request !== generation.current) throw new WorkspaceError('Votre session a changé. Reconnectez-vous pour vérifier le résultat.', 'session');
      const next = await repository?.load();
      if (!mounted.current || request !== generation.current) throw new WorkspaceError('Votre session a changé. Reconnectez-vous pour vérifier le résultat.', 'session');
      if (mounted.current && request === generation.current) { setSnapshot(next || null); setError(''); setLoading(false); }
      return result;
    } finally {
      busy.current = false; controlledAuth.current = null;
      if (mounted.current) { setSaving(false); setRefreshing(false); if (request !== generation.current) void reload(); }
    }
  };
  const selectRestaurant = async (id: string | null) => {
    if (busy.current) return;
    ++generation.current; setSnapshot(null); setLoading(true); setError('');
    accountRepository?.selectRestaurant(id);
    await reload();
  };
  const dismissInvitation = () => { clearInvitation(); setInvitation(null); };
  const acceptInvitation = async () => {
    const accounts = accountRepository;
    if (!invitation || !accounts) return;
    await accountAction(() => accounts.acceptInvitation(invitation));
    dismissInvitation();
  };
  const cancelRecovery = () => {
    const url = new URL(location.href); url.searchParams.delete('flow'); url.hash = ''; history.replaceState(null, '', url);
    setRecovery(false);
    setRecoveryRequested(false);
  };
  const finishRecovery = async (password: string) => {
    const accounts = accountRepository;
    if (!accounts) return;
    await accountAction(() => accounts.updatePassword(password));
    cancelRecovery();
  };
  return { cancelRecovery, invitation, dismissInvitation, acceptInvitation, recovery, recoveryRequested, finishRecovery, accountAction, selectRestaurant, snapshot, loading, refreshing, saving, error, reload, signIn, signOut, mutate, mode: repository?.mode || "demo" };
}
