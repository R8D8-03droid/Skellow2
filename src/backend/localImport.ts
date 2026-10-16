import type { Employee, Shift } from "../types";
import { WorkspaceError, type WorkspaceChanges, type WorkspaceSnapshot } from "./contracts";
import { employeeRecord, shiftRecord, fromEmployee, fromShift } from "./mapping";

export interface ImportPreview {
  changes: WorkspaceChanges;
  members: Employee[];
  services: Shift[];
  matched: number;
  skipped: number;
}
const invalid = (message: string): never => { throw new WorkspaceError(message, "import"); };

/** Read existing data only. Never invoke the demo seed loaders in connected mode. */
export function readLocalImport(snapshot: WorkspaceSnapshot): ImportPreview {
  try {
    return prepareImport(JSON.parse(localStorage.getItem("hotel_employees") || "[]"), JSON.parse(localStorage.getItem("hotel_shifts") || "[]"), snapshot);
  } catch (cause) {
    if (cause instanceof WorkspaceError) throw cause;
    return invalid("Les données locales ne peuvent pas être lues. Conservez une copie avant de les corriger.");
  }
}
export function prepareImport(rawEmployees: unknown, rawShifts: unknown, snapshot: WorkspaceSnapshot): ImportPreview {
  if (!Array.isArray(rawEmployees) || !Array.isArray(rawShifts)) return invalid("Le format des données locales est invalide.");
  const members: Employee[] = [], services: Shift[] = [];
  const ids = new Map<string, string>(), emails = new Set<string>(), shiftIds = new Set<string>();
  let matched = 0, skipped = 0;
  try {
    for (const raw of rawEmployees) {
      // Reconstruct from explicit field allowlists. Passwords, Auth IDs and local
      // admin privileges never enter the preview or the outgoing request.
      const record = employeeRecord(raw);
      if (!record.id || typeof record.id !== "string" || ids.has(record.id) || emails.has(record.email)) return invalid("Des membres locaux ont le même identifiant ou la même adresse. Corrigez ces doublons avant l’import.");
      emails.add(record.email);
      const sameId = snapshot.employees.find(e => e.id === record.id);
      const existing = snapshot.employees.find(e => e.email.toLowerCase() === record.email);
      if (sameId && sameId.id !== existing?.id) return invalid("Un identifiant local correspond à un autre membre dans l’espace partagé. Aucun import n’a été effectué.");
      if (existing) { ids.set(record.id, existing.id); matched++; continue; }
      const employee = fromEmployee({ ...record, role: "employee", revision: 1, access_linked: false });
      employee.revision = undefined;
      ids.set(employee.id, employee.id);
      members.push(employee);
    }
    for (const raw of rawShifts) {
      const record = shiftRecord(raw);
      if (!record.id || typeof record.id !== "string" || shiftIds.has(record.id)) return invalid("Des services locaux ont un identifiant absent ou en double.");
      shiftIds.add(record.id);
      const employeeId = ids.get(record.employee_id);
      if (!employeeId) return invalid("Un service local référence une fiche absente. Corrigez son attribution avant l’import.");
      const service = fromShift({ ...record, employee_id: employeeId, revision: 1 });
      service.revision = undefined;
      const existing = snapshot.shifts.find(s => s.id === service.id);
      if (existing) {
        if (JSON.stringify(shiftRecord(existing)) !== JSON.stringify(shiftRecord(service))) return invalid("Un service existe déjà avec des informations différentes. L’import ne remplace aucun service partagé.");
        skipped++; continue;
      }
      const employee = members.find(e => e.id === employeeId) || snapshot.employees.find(e => e.id === employeeId);
      if (!employee?.active) return invalid("Un service à importer appartient à un membre archivé. Réactivez d’abord sa fiche pour reprendre cet historique.");
      services.push(service);
    }
  } catch (cause) {
    if (cause instanceof WorkspaceError) throw cause;
    return invalid("Une fiche locale est incomplète ou invalide. Aucun import n’a été effectué.");
  }
  if (members.length + services.length > 500) return invalid("Cet import dépasse 500 fiches et services. Une reprise accompagnée est nécessaire pour conserver un import complet.");
  return { members, services, matched, skipped, changes: {
    employees: members.map(value => ({ kind: "save", value })),
    shifts: services.map(value => ({ kind: "save", value })),
  } };
}
