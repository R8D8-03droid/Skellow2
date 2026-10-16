import type { Employee, Shift } from '../src/types';
import { employeeRecord, shiftRecord } from '../src/backend/mapping';

export const member = (id = 'member'): Employee => ({
  id, firstName: 'Julie', lastName: 'Martin', email: `${id}@example.com`, phone: '',
  position: 'DJ', department: 'Animation', contractType: 'CDI', startDate: '2026-01-01',
  hourlyRate: 20, monthlyHours: 151.67, socialSecurityNumber: '', address: '',
  postalCode: '', city: '', bankRIB: '', role: 'employee', active: true, nightWork: true,
});
export const service = (id = 'service'): Shift => ({
  id, employeeId: 'member', date: '2026-10-12', startTime: '22:00', endTime: '05:00',
  role: 'DJ', notes: '', status: 'scheduled', isNightShift: true,
});
export const serverSnapshot = () => ({ current_employee_id: 'member',
  employees: [{ ...employeeRecord(member()), revision: 1, access_linked: true }],
  shifts: [{ ...shiftRecord(service()), revision: 1 }],
});
