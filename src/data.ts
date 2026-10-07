import { Employee, Shift } from './types';

const defaultEmployees: Employee[] = [
  {
    id: 'admin-1',
    firstName: 'Alex',
    lastName: 'Dupont',
    email: 'admin@nightclub.fr',
    phone: '06 12 34 56 78',
    position: 'Directeur',
    department: 'Direction',
    contractType: 'CDI',
    startDate: '2020-01-15',
    hourlyRate: 18,
    monthlyHours: 151.67,
    socialSecurityNumber: '1 85 12 75 123 456 78',
    address: '12 Rue de la Nuit',
    postalCode: '75011',
    city: 'Paris',
    bankRIB: 'FR76 1234 5678 9012 3456 7890 123',
    password: 'admin123',
    role: 'admin',
    active: true,
    nightWork: false,
  },
  {
    id: 'emp-1',
    firstName: 'DJ',
    lastName: 'Max',
    email: 'dj.max@nightclub.fr',
    phone: '06 23 45 67 89',
    position: 'DJ',
    department: 'DJ/Animation',
    contractType: 'CDI',
    startDate: '2021-03-01',
    hourlyRate: 15,
    monthlyHours: 151.67,
    socialSecurityNumber: '1 90 05 75 234 567 89',
    address: '45 Avenue des Clubs',
    postalCode: '75018',
    city: 'Paris',
    bankRIB: 'FR76 2345 6789 0123 4567 8901 234',
    password: 'max123',
    role: 'employee',
    active: true,
    nightWork: true,
  },
  {
    id: 'emp-2',
    firstName: 'Julie',
    lastName: 'Martin',
    email: 'julie.martin@nightclub.fr',
    phone: '06 34 56 78 90',
    position: 'Barmaid',
    department: 'Bar',
    contractType: 'CDD',
    startDate: '2024-06-01',
    endDate: '2025-06-01',
    hourlyRate: 11.65,
    monthlyHours: 151.67,
    socialSecurityNumber: '2 95 08 69 345 678 90',
    address: '78 Boulevard Voltaire',
    postalCode: '75011',
    city: 'Paris',
    bankRIB: 'FR76 3456 7890 1234 5678 9012 345',
    password: 'julie123',
    role: 'employee',
    active: true,
    nightWork: true,
  },
  {
    id: 'emp-3',
    firstName: 'Karim',
    lastName: 'Benali',
    email: 'karim.benali@nightclub.fr',
    phone: '06 45 67 89 01',
    position: 'Agent de sécurité',
    department: 'Sécurité',
    contractType: 'CDI',
    startDate: '2019-09-15',
    hourlyRate: 12.5,
    monthlyHours: 151.67,
    socialSecurityNumber: '1 88 03 75 456 789 01',
    address: '23 Rue du Faubourg',
    postalCode: '75010',
    city: 'Paris',
    bankRIB: 'FR76 4567 8901 2345 6789 0123 456',
    password: 'karim123',
    role: 'employee',
    active: true,
    nightWork: true,
  },
  {
    id: 'emp-4',
    firstName: 'Léa',
    lastName: 'Moreau',
    email: 'lea.moreau@nightclub.fr',
    phone: '06 56 78 90 12',
    position: 'Hôtesse d\'accueil',
    department: 'Accueil/Caisse',
    contractType: 'CDI',
    startDate: '2022-01-10',
    hourlyRate: 11.65,
    monthlyHours: 151.67,
    socialSecurityNumber: '2 93 11 75 567 890 12',
    address: '56 Rue de Rivoli',
    postalCode: '75004',
    city: 'Paris',
    bankRIB: 'FR76 5678 9012 3456 7890 1234 567',
    password: 'lea123',
    role: 'employee',
    active: true,
    nightWork: true,
  },
];

function generateDefaultShifts(): Shift[] {
  const shifts: Shift[] = [];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  // Horaires typiques d'une boîte de nuit (ouverture 22h-23h, fermeture 5h-6h)
  const employeeShifts = [
    { employeeId: 'emp-1', shifts: [ // DJ Max
      { dayOffset: 4, start: '22:00', end: '05:00', role: 'DJ' }, // Vendredi soir
      { dayOffset: 5, start: '22:00', end: '05:00', role: 'DJ' }, // Samedi soir
    ]},
    { employeeId: 'emp-2', shifts: [ // Julie (Barmaid)
      { dayOffset: 2, start: '20:00', end: '04:00', role: 'Barmaid' }, // Mercredi
      { dayOffset: 4, start: '20:00', end: '04:00', role: 'Barmaid' }, // Vendredi
      { dayOffset: 5, start: '20:00', end: '04:00', role: 'Barmaid' }, // Samedi
    ]},
    { employeeId: 'emp-3', shifts: [ // Karim (Sécurité)
      { dayOffset: 3, start: '21:00', end: '06:00', role: 'Agent de sécurité' }, // Jeudi
      { dayOffset: 4, start: '21:00', end: '06:00', role: 'Agent de sécurité' }, // Vendredi
      { dayOffset: 5, start: '21:00', end: '06:00', role: 'Agent de sécurité' }, // Samedi
    ]},
    { employeeId: 'emp-4', shifts: [ // Léa (Accueil)
      { dayOffset: 4, start: '22:00', end: '04:00', role: 'Hôtesse d\'accueil' }, // Vendredi
      { dayOffset: 5, start: '22:00', end: '04:00', role: 'Hôtesse d\'accueil' }, // Samedi
    ]},
  ];

  let id = 1;
  employeeShifts.forEach(({ employeeId, shifts: empShifts }) => {
    empShifts.forEach(({ dayOffset, start, end, role }) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayOffset);
      shifts.push({
        id: `shift-${id++}`,
        employeeId,
        date: date.toISOString().split('T')[0],
        startTime: start,
        endTime: end,
        role,
      });
    });
  });

  return shifts;
}

export function loadEmployees(): Employee[] {
  const stored = localStorage.getItem('hotel_employees');
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem('hotel_employees', JSON.stringify(defaultEmployees));
  return defaultEmployees;
}

export function saveEmployees(employees: Employee[]) {
  localStorage.setItem('hotel_employees', JSON.stringify(employees));
}

export function loadShifts(): Shift[] {
  const stored = localStorage.getItem('hotel_shifts');
  if (stored) {
    return JSON.parse(stored);
  }
  const defaultShifts = generateDefaultShifts();
  localStorage.setItem('hotel_shifts', JSON.stringify(defaultShifts));
  return defaultShifts;
}

export function saveShifts(shifts: Shift[]) {
  localStorage.setItem('hotel_shifts', JSON.stringify(shifts));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
