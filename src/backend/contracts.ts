import type { Account, Restaurant, MembershipRole } from "./account";
import type { Employee, Shift } from "../types";

export interface WorkspaceSnapshot {
  currentEmployeeId: string;
  account?: Account;
  restaurants?: Restaurant[];
  restaurantId?: string | null;
  membershipRole?: MembershipRole | null;
  employees: Employee[];
  shifts: Shift[];
}
export type Change<T> = { kind: "save"; value: T } | { kind: "delete"; value: T };
export interface WorkspaceChanges {
  employees?: Change<Employee>[];
  shifts?: Change<Shift>[];
}
export interface WorkspaceRepository {
  mode: "demo" | "supabase";
  load(): Promise<WorkspaceSnapshot | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (change?: { event: string; email?: string; authenticated?: boolean; identityChanged?: boolean }) => void): () => void;
  mutate(changes: WorkspaceChanges, demoPassword?: string): Promise<WorkspaceSnapshot>;
}

export class WorkspaceError extends Error {
  constructor(message: string, public readonly code = "unknown") { super(message); }
}
export function errorMessage(error: unknown): string {
  if (error instanceof WorkspaceError) return error.message;
  return "La connexion a échoué. Vérifiez votre réseau puis réessayez.";
}

export function backendError(error: { code?: string; message?: string; status?: number; name?: string }, writing = false): WorkspaceError {
  const code = error.code || "network";
  const messages: Record<string, string> = {
    invitation_email_mismatch: "Cette invitation est destinée à une autre adresse e-mail. Connectez-vous avec l’adresse invitée.",
    invitation_expired: "Cette invitation a expiré ou a été révoquée. Demandez un nouveau lien au propriétaire.",
    invalid_invitation: "Ce lien d’invitation est invalide. Demandez un nouveau lien au propriétaire.",
    invitation_employee_mismatch: "Choisissez une fiche active dont l’adresse correspond à l’invitation.",
    linked_employee: "Cette fiche est déjà liée à un compte, même si son accès est suspendu. Réactivez ce compte dans la liste des accès.",
    already_member: "Cette personne dispose déjà d’un accès. Modifiez-le dans la liste des accès.",
    last_owner: "Conservez au moins un propriétaire actif pour cet établissement.",
    owner_required: "Seul un propriétaire peut gérer les accès à cet établissement.",
    restaurant_access_denied: "Votre accès à cet établissement n’est plus disponible. Ouvrez un établissement auquel vous avez accès.",
    confirmed_account_required: "Confirmez votre adresse e-mail avant de continuer.",
    manage_role_in_access: "Les droits se gèrent dans Accès, séparément de la fiche salarié.",
  };
  if (error.message && messages[error.message]) return new WorkspaceError(messages[error.message], code);
  if (code === "40001") return new WorkspaceError("Cette fiche ou ce service a changé entre-temps. Fermez puis rouvrez la fiche pour reprendre la dernière version.", code);
  if (code === "23P01") return new WorkspaceError("Ce membre a déjà un service à cet horaire, y compris sur la journée suivante. Actualisez le planning.", code);
  if (["23503", "23001"].includes(code)) return new WorkspaceError("Ce membre possède des services. Archivez sa fiche pour conserver son historique.", code);
  if (code === "23505") return new WorkspaceError("Cette adresse e-mail ou cet identifiant existe déjà. Actualisez les données avant de réessayer.", code);
  if (error.message === "inactive_employee") return new WorkspaceError("Ce membre est archivé. Réactivez sa fiche avant de lui attribuer un service.", code);
  if (error.message === "linked_email_change") return new WorkspaceError("Cette adresse est liée à un compte de connexion. Sa modification doit être effectuée par le gestionnaire des accès.", code);
  if (error.message === "cannot_remove_own_access") return new WorkspaceError("Vous ne pouvez pas retirer votre propre accès administrateur.", code);
  if (code === "42501") return new WorkspaceError("Votre compte n’a pas accès à cette opération. Actualisez ou contactez le propriétaire de l’établissement.", code);
  if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || ["PGRST301", "PGRST302", "PGRST303", "refresh_token_not_found", "session_not_found"].includes(code)) return new WorkspaceError("Votre session a expiré. Reconnectez-vous pour continuer.", "session");
  if (["23514", "23502", "22023", "22007", "22008", "22P02", "22003"].includes(code)) return new WorkspaceError("Certaines informations sont invalides. Vérifiez les champs, les dates et les horaires.", code);
  if (["PGRST202", "42P01"].includes(code)) return new WorkspaceError("La base de données n’est pas encore initialisée. Appliquez la migration décrite dans BACKEND.md.", code);
  return new WorkspaceError(writing
    ? "Sauvegarde non confirmée. Actualisez pour vérifier les données ; vous pouvez réessayer sans créer de doublon."
    : "Impossible de charger les données partagées. Vérifiez votre connexion puis réessayez.", code);
}
