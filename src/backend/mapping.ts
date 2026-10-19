import type { Employee, Shift } from "../types";
import type { WorkspaceSnapshot } from "./contracts";

// Explicit allowlists: credentials, Auth IDs and client-supplied revisions never
// become writable columns, including when importing legacy localStorage data.
export function employeeRecord(e: Employee) {
  return {
    id: e.id, first_name: e.firstName.trim(), last_name: e.lastName.trim(),
    email: e.email.trim().toLowerCase(), phone: e.phone, position: e.position.trim(),
    department: e.department, contract_type: e.contractType, start_date: e.startDate,
    end_date: e.endDate || null, hourly_rate: e.hourlyRate, monthly_hours: e.monthlyHours,
    social_security_number: e.socialSecurityNumber, address: e.address,
    postal_code: e.postalCode, city: e.city, bank_rib: e.bankRIB,
    role: e.role, active: e.active, night_work: !!e.nightWork,
  };
}
export function shiftRecord(s: Shift) {
  return { id: s.id, employee_id: s.employeeId, date: s.date, start_time: s.startTime,
    end_time: s.endTime, role: s.role.trim(), notes: s.notes || "",
    is_night_shift: !!s.isNightShift, status: s.status || "scheduled" };
}
type EmployeeRecord = ReturnType<typeof employeeRecord> & { revision: number; access_linked: boolean };
type ShiftRecord = ReturnType<typeof shiftRecord> & { revision: number };
export function fromEmployee(e: EmployeeRecord): Employee {
  return { id: e.id, firstName: e.first_name, lastName: e.last_name, email: e.email,
    phone: e.phone, position: e.position, department: e.department, contractType: e.contract_type,
    startDate: e.start_date, endDate: e.end_date || undefined, hourlyRate: Number(e.hourly_rate),
    monthlyHours: Number(e.monthly_hours), socialSecurityNumber: e.social_security_number,
    address: e.address, postalCode: e.postal_code, city: e.city, bankRIB: e.bank_rib,
    role: e.role, active: e.active, nightWork: e.night_work, revision: e.revision, accessLinked: e.access_linked };
}
export function fromShift(s: ShiftRecord): Shift {
  return { id: s.id, employeeId: s.employee_id, date: s.date, startTime: s.start_time.slice(0, 5),
    endTime: s.end_time.slice(0, 5), role: s.role, notes: s.notes, isNightShift: s.is_night_shift,
    status: s.status, revision: s.revision };
}
export function fromSnapshot(data: { current_employee_id: string | null; employees: EmployeeRecord[]; shifts: ShiftRecord[]; account?: WorkspaceSnapshot["account"]; restaurants?: WorkspaceSnapshot["restaurants"]; restaurant_id?: string | null; membership_role?: WorkspaceSnapshot["membershipRole"] }): WorkspaceSnapshot {
  return { ...(data.account ? { account: data.account, restaurants: data.restaurants || [], restaurantId: data.restaurant_id, membershipRole: data.membership_role } : {}), currentEmployeeId: data.current_employee_id || "", employees: data.employees.map(fromEmployee), shifts: data.shifts.map(fromShift) };
}
