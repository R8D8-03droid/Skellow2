import { Employee, Shift } from '../types';
import { format, startOfWeek, addDays, isToday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardProps {
  employees: Employee[];
  shifts: Shift[];
  currentUser: Employee;
}

export default function Dashboard({ employees, shifts, currentUser }: DashboardProps) {
  const isAdmin = currentUser.role === 'admin';
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Calculate today's shifts
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayShifts = shifts.filter((s) => s.date === todayStr);
  
  // Calculate this week's shifts for current user
  const userWeekShifts = shifts.filter(
    (s) => s.employeeId === currentUser.id && isThisWeek(new Date(s.date), { weekStartsOn: 1 })
  );

  // Calculate total hours this week for current user (excluding absences)
  const totalHoursThisWeek = userWeekShifts.reduce((total, shift) => {
    // Exclure les absences
    if (shift.status === 'absence_justified' || shift.status === 'absence_unjustified') {
      return total;
    }
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    return total + (hours < 0 ? hours + 24 : hours);
  }, 0);

  // Count absences this week
  const absenceCount = userWeekShifts.filter(
    (s) => s.status === 'absence_justified' || s.status === 'absence_unjustified'
  ).length;

  // Active employees count
  const activeEmployees = employees.filter((e) => e.active && e.role === 'employee').length;

  // Department distribution
  const departments = [...new Set(employees.filter(e => e.active && e.role === 'employee').map(e => e.department))];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Bonjour, {currentUser.firstName} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-clock text-purple-600"></i>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Cette semaine</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{totalHoursThisWeek.toFixed(1)}h</p>
          <p className="text-sm text-gray-500">Heures travaillées</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-moon text-blue-600"></i>
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Semaine</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{userWeekShifts.length}</p>
          <p className="text-sm text-gray-500">Shifts de nuit</p>
        </div>

        {isAdmin && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <i className="fas fa-users text-violet-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{activeEmployees}</p>
              <p className="text-sm text-gray-500">Employés actifs</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <i className="fas fa-user-times text-orange-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{absenceCount}</p>
              <p className="text-sm text-gray-500">Absences cette semaine</p>
            </div>
          </>
        )}
      </div>

      {/* Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-moon text-purple-500"></i>
            Planning du soir
          </h2>
          {todayShifts.length > 0 ? (
            <div className="space-y-3">
              {todayShifts.map((shift) => {
                const employee = employees.find((e) => e.id === shift.employeeId);
                const isAbsent = shift.status === 'absence_justified' || shift.status === 'absence_unjustified';
                const isJustified = shift.status === 'absence_justified';
                return (
                  <div key={shift.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                    isAbsent ? (isJustified ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-200') : 'bg-gray-50'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                      isAbsent ? (isJustified ? 'bg-gradient-to-br from-orange-400 to-amber-500' : 'bg-gradient-to-br from-red-400 to-rose-500') : 'bg-gradient-to-br from-purple-400 to-violet-500'
                    }`}>
                      {employee?.firstName[0]}{employee?.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">
                        {employee?.firstName} {employee?.lastName}
                      </p>
                      <p className={`text-xs ${isAbsent ? (isJustified ? 'text-orange-600' : 'text-red-600') : 'text-gray-500'}`}>
                        {isAbsent ? (isJustified ? '⚕️ Absence justifiée' : '⚠️ Absence injustifiée') : shift.role}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isAbsent ? 'line-through opacity-50' : ''} text-gray-700`}>
                        {shift.startTime} - {shift.endTime}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Aucun shift ce soir</p>
          )}
        </div>

        {/* My upcoming shifts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-week text-purple-500"></i>
            Mes prochains shifts
          </h2>
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => {
              const date = addDays(weekStart, i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayShifts = userWeekShifts.filter((s) => s.date === dateStr);
              
              if (dayShifts.length === 0) return null;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    isToday(date) ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                    isToday(date) ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <span className="text-[10px] font-medium uppercase">{format(date, 'EEE', { locale: fr })}</span>
                    <span className="text-sm font-bold">{format(date, 'd')}</span>
                  </div>
                  <div className="flex-1">
                    {dayShifts.map((shift) => (
                      <p key={shift.id} className="text-sm text-gray-700">
                        <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                        <span className="text-gray-400 ml-2">({shift.role})</span>
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
            {userWeekShifts.length === 0 && (
              <p className="text-gray-400 text-center py-8">Aucun shift cette semaine</p>
            )}
          </div>
        </div>
      </div>

      {/* Department Overview (Admin only) */}
      {isAdmin && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-building text-purple-500"></i>
            Répartition par département
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {departments.map((dept) => {
              const count = employees.filter((e) => e.department === dept && e.active && e.role === 'employee').length;
              const colors: Record<string, string> = {
                'Bar': 'from-blue-400 to-cyan-500',
                'Sécurité': 'from-red-400 to-rose-500',
                'Accueil/Caisse': 'from-green-400 to-emerald-500',
                'Vestiaire': 'from-yellow-400 to-amber-500',
                'DJ/Animation': 'from-purple-400 to-violet-500',
                'Direction': 'from-indigo-400 to-blue-500',
                'Ménage/Entretien': 'from-gray-400 to-slate-500',
              };
              return (
                <div key={dept} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className={`w-12 h-12 mx-auto mb-2 bg-gradient-to-br ${colors[dept] || 'from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center`}>
                    <span className="text-white font-bold text-lg">{count}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{dept}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
