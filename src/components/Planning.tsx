import { useState } from 'react';
import { Employee, Shift } from '../types';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PlanningProps {
  employees: Employee[];
  shifts: Shift[];
  currentUser: Employee;
  onUpdateShifts: (shifts: Shift[]) => void;
}

export default function Planning({ employees, shifts, currentUser, onUpdateShifts }: PlanningProps) {
  const isAdmin = currentUser.role === 'admin';
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const days = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  const activeEmployees = employees.filter((e) => e.active && e.role === 'employee');
  const departments = [...new Set(activeEmployees.map((e) => e.department))];

  const filteredEmployees = selectedDepartment === 'all'
    ? activeEmployees
    : activeEmployees.filter((e) => e.department === selectedDepartment);

  const getShiftsForDay = (employeeId: string, date: string) => {
    return shifts.filter((s) => s.employeeId === employeeId && s.date === date);
  };

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = eh * 60 + em - sh * 60 - sm;
    return minutes < 0 ? (minutes + 24 * 60) / 60 : minutes / 60;
  };

  const handleDeleteShift = (shiftId: string) => {
    if (confirm('Supprimer ce shift ?')) {
      onUpdateShifts(shifts.filter((s) => s.id !== shiftId));
    }
  };

  const handleSaveShift = (shift: Shift) => {
    const existing = shifts.findIndex((s) => s.id === shift.id);
    if (existing >= 0) {
      const updated = [...shifts];
      updated[existing] = shift;
      onUpdateShifts(updated);
    } else {
      onUpdateShifts([...shifts, shift]);
    }
    setShowAddModal(false);
    setEditingShift(null);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-amber-500"></i>
            Planning hebdomadaire
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Semaine du {format(currentWeekStart, 'd MMMM', { locale: fr })} au{' '}
            {format(addDays(currentWeekStart, 6), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Tous les départements</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <button
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fas fa-chevron-left text-gray-600"></i>
          </button>
          <button
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fas fa-chevron-right text-gray-600"></i>
          </button>
          {isAdmin && (
            <button
              onClick={() => { setEditingShift(null); setShowAddModal(true); }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-xl shadow hover:shadow-lg transition-all"
            >
              <i className="fas fa-plus mr-2"></i>Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Planning Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[160px]">
                  Employé
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[120px] ${
                      isToday(day) ? 'bg-amber-50 text-amber-700' : 'text-gray-500'
                    }`}
                  >
                    <div>{format(day, 'EEE', { locale: fr })}</div>
                    <div className={`text-lg font-bold ${isToday(day) ? 'text-amber-600' : 'text-gray-800'}`}>
                      {format(day, 'd')}
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 bg-gray-50 z-10 px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[160px] border-l border-gray-200">
                  <div>Total</div>
                  <div className="text-[10px] font-normal text-gray-400 normal-case">/ Contrat</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEmployees.map((employee) => {
                // Calcul du total hebdomadaire AVANT le rendu
                let weekTotal = 0;
                days.forEach((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayShifts = getShiftsForDay(employee.id, dateStr);
                  dayShifts.forEach((s) => {
                    weekTotal += calculateHours(s.startTime, s.endTime);
                  });
                });

                const weeklyContractHours = employee.monthlyHours / 4.33;
                const difference = weekTotal - weeklyContractHours;
                const isPositive = difference > 0.05;
                const isNegative = difference < -0.05;

                return (
                  <tr key={employee.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white z-10 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{employee.department}</p>
                        </div>
                      </div>
                    </td>
                    {days.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayShifts = getShiftsForDay(employee.id, dateStr);

                      return (
                        <td key={dateStr} className={`px-2 py-2 text-center ${isToday(day) ? 'bg-amber-50/30' : ''}`}>
                          {dayShifts.length > 0 ? (
                            <div className="space-y-1">
                              {dayShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className="group relative bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:shadow-sm transition-all"
                                  onClick={() => isAdmin && setEditingShift(shift)}
                                >
                                  <p className="font-semibold text-amber-800">
                                    {shift.startTime} - {shift.endTime}
                                  </p>
                                  <p className="text-amber-600 text-[10px]">{shift.role}</p>
                                  {isAdmin && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-8 flex items-center justify-center">
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setEditingShift({
                                      id: '',
                                      employeeId: employee.id,
                                      date: dateStr,
                                      startTime: '09:00',
                                      endTime: '17:00',
                                      role: employee.position,
                                    });
                                    setShowAddModal(true);
                                  }}
                                  className="w-6 h-6 rounded-full border-2 border-dashed border-gray-200 text-gray-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xs"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bg-white z-10 px-3 py-3 text-center border-l border-gray-200">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-sm font-bold text-gray-800">
                          {weekTotal.toFixed(1)}h
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          / {weeklyContractHours.toFixed(1)}h
                        </span>
                        <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'text-green-700 bg-green-100'
                            : isNegative
                              ? 'text-red-700 bg-red-100'
                              : 'text-gray-500 bg-gray-100'
                        }`}>
                          {isPositive ? '+' : isNegative ? '' : ''}{difference.toFixed(1)}h
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Shift Modal */}
      {showAddModal && (
        <ShiftModal
          shift={editingShift}
          employees={filteredEmployees}
          onSave={handleSaveShift}
          onClose={() => { setShowAddModal(false); setEditingShift(null); }}
        />
      )}
    </div>
  );
}

interface ShiftModalProps {
  shift: Shift | null;
  employees: Employee[];
  onSave: (shift: Shift) => void;
  onClose: () => void;
}

function ShiftModal({ shift, employees, onSave, onClose }: ShiftModalProps) {
  const [employeeId, setEmployeeId] = useState(shift?.employeeId || employees[0]?.id || '');
  const [date, setDate] = useState(shift?.date || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(shift?.startTime || '09:00');
  const [endTime, setEndTime] = useState(shift?.endTime || '17:00');
  const [role, setRole] = useState(shift?.role || '');
  const [notes, setNotes] = useState(shift?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: shift?.id || `shift-${Date.now()}`,
      employeeId,
      date,
      startTime,
      endTime,
      role,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5">
          {shift?.id ? 'Modifier le shift' : 'Ajouter un shift'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: Chef de rang, Serveur..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
              placeholder="Remplacement, formation..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
