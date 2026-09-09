export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  contractType: 'CDI' | 'CDD' | 'Alternance' | 'Stage';
  startDate: string;
  endDate?: string;
  hourlyRate: number;
  monthlyHours: number;
  socialSecurityNumber: string;
  address: string;
  postalCode: string;
  city: string;
  bankRIB: string;
  password: string;
  role: 'admin' | 'employee';
  active: boolean;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  role: string;
  notes?: string;
}

export interface PaySlip {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  totalHours: number;
  overtimeHours: number;
  baseSalary: number;
  overtimePay: number;
  grossSalary: number;
  socialCharges: number;
  netSalary: number;
  generatedAt: string;
}

export type ViewType = 'planning' | 'employees' | 'payslips' | 'dashboard';
