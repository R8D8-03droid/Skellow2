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
  nightWork?: boolean; // Travail de nuit régulier
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  role: string;
  notes?: string;
  isNightShift?: boolean; // Travail de nuit (21h-6h)
}

export interface PaySlip {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  totalHours: number;
  regularHours: number;
  overtime25Hours: number; // Heures sup 36-43h (25%)
  overtime50Hours: number; // Heures sup 44h+ (50%)
  nightHours: number; // Heures de nuit
  baseSalary: number;
  overtime25Pay: number;
  overtime50Pay: number;
  nightBonus: number;
  grossSalary: number;
  socialCharges: number;
  netSalary: number;
  generatedAt: string;
}

export type ViewType = 'planning' | 'employees' | 'payslips' | 'dashboard';
