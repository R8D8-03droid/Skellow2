import { loadEmployees, loadShifts, saveEmployees, saveShifts, demoPasswordMatches, saveDemoPassword } from "../data";
import { WorkspaceError, type WorkspaceRepository, type WorkspaceChanges, type Change } from "./contracts";

function apply<T extends { id: string; revision?: number }>(records: T[], changes: Change<T>[] = []): T[] {
  let next = [...records];
  for (const { kind, value } of changes) {
    const previous = next.find(r => r.id === value.id);
    if ((previous?.revision ?? null) !== (value.revision ?? null)) throw new WorkspaceError("Cette fiche a changé. Fermez puis rouvrez-la pour reprendre la dernière version.", "40001");
    if (kind === "delete") next = next.filter(r => r.id !== value.id);
    else {
      const saved = { ...value, revision: (previous?.revision || 0) + 1 };
      next = previous ? next.map(r => r.id === value.id ? saved : r) : [...next, saved];
    }
  }
  return next;
}
export class DemoRepository implements WorkspaceRepository {
  readonly mode = "demo";
  private read() {
    const employees = loadEmployees();
    const shifts = loadShifts();
    const id = JSON.parse(localStorage.getItem("hotel_current_user") || "null")?.id;
    const user = employees.find(e => e.id === id && e.active);
    return user ? { currentEmployeeId: user.id, employees, shifts } : null;
  }
  async load() { return this.read(); }
  async signIn(email: string, password: string) {
    const person = loadEmployees().find(e => e.email.toLowerCase() === email.trim().toLowerCase() && e.active && demoPasswordMatches(e.id, password));
    if (!person) throw new WorkspaceError("L’adresse e-mail ou le mot de passe est incorrect, ou le compte est inactif.");
    localStorage.setItem("hotel_current_user", JSON.stringify({ id: person.id }));
  }
  async signOut() { localStorage.removeItem("hotel_current_user"); }
  subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => { if (!event.key || ["hotel_current_user", "hotel_employees", "hotel_shifts"].includes(event.key)) listener(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }
  async mutate(changes: WorkspaceChanges, demoPassword?: string) {
    const current = this.read();
    if (!current || current.employees.find(e => e.id === current.currentEmployeeId)?.role !== "admin") throw new WorkspaceError("Un accès administrateur est nécessaire.");
    const employees = apply(current.employees, changes.employees);
    const shifts = apply(current.shifts, changes.shifts);
    if (shifts.some(s => !employees.some(e => e.id === s.employeeId))) throw new WorkspaceError("Archivez ce membre pour conserver ses services.");
    if (changes.employees?.length) {
      if (demoPassword && changes.employees[0].kind === "save") saveDemoPassword(changes.employees[0].value.id, demoPassword);
      saveEmployees(employees);
    }
    if (changes.shifts?.length) saveShifts(shifts);
    return { ...current, employees, shifts };
  }
}
