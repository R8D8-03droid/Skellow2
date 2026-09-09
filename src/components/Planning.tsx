import { useState } from 'react';
import { Employee, Shift } from '../types';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ shift: Shift; x: number; y: number } | null>(null);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  const activeEmployees = employees.filter((e) => e.active && e.role === 'employee');
  const departments = [...new Set(activeEmployees.map((e) => e.department))];

  const filteredEmployees = selectedDepartment === 'all'
    ? activeEmployees
    : activeEmployees.filter((e) => e.department === selectedDepartment);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

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
    setContextMenu(null);
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

  const handleDragStart = (event: DragStartEvent) => {
    if (!isAdmin) return;
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isAdmin) return;
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const shiftId = active.id as string;
    const dropData = over.id as string;
    
    // Parse drop target: "cell::{employeeId}::{date}"
    if (!dropData.startsWith('cell::')) return;
    
    const payload = dropData.replace('cell::', '');
    const sepIndex = payload.lastIndexOf('::');
    if (sepIndex === -1) return;
    
    const employeeId = payload.substring(0, sepIndex);
    const date = payload.substring(sepIndex + 2);
    
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    if (copyMode) {
      // Create a copy of the shift
      const newShift: Shift = {
        ...shift,
        id: `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        date,
      };
      onUpdateShifts([...shifts, newShift]);
    } else {
      // Move the shift
      const updated = shifts.map((s) =>
        s.id === shiftId ? { ...s, employeeId, date } : s
      );
      onUpdateShifts(updated);
    }
  };

  const handleShiftClick = (shift: Shift, e: React.MouseEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ shift, x: e.clientX, y: e.clientY });
  };

  const handleAddShiftToCell = (employeeId: string, date: string) => {
    if (!isAdmin) return;
    const employee = employees.find((e) => e.id === employeeId);
    setEditingShift({
      id: '',
      employeeId,
      date,
      startTime: '09:00',
      endTime: '17:00',
      role: employee?.position || '',
    });
    setShowAddModal(true);
  };

  // Close context menu on click outside
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div className="p-6 lg:p-8" onClick={handleCloseContextMenu}>
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
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setCopyMode(!copyMode)}
              className={`px-3 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${
                copyMode
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Mode copie : maintenez activé pour copier les shifts au lieu de les déplacer"
            >
              <i className="fas fa-copy"></i>
              <span>{copyMode ? 'Mode copie ON' : 'Copier'}</span>
            </button>
          )}
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

      {/* Help text for drag & drop */}
      {isAdmin && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 flex items-start gap-2">
          <i className="fas fa-info-circle mt-0.5"></i>
          <div>
            <span className="font-medium">Glissez-déposez</span> les shifts pour les déplacer. 
            Activez le <span className="font-medium">mode copie</span> pour dupliquer un shift au lieu de le déplacer. 
            <span className="font-medium">Cliquez</span> sur un shift pour le modifier ou le supprimer.
          </div>
        </div>
      )}

      {/* Planning Table */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Employé
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[130px] ${
                        isToday(day) ? 'bg-amber-50 text-amber-700' : 'text-gray-500'
                      }`}
                    >
                      <div>{format(day, 'EEE', { locale: fr })}</div>
                      <div className={`text-lg font-bold ${isToday(day) ? 'text-amber-600' : 'text-gray-800'}`}>
                        {format(day, 'd')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.map((employee) => {
                  // Calcul du total hebdomadaire
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
                        <div className="flex items-center gap-3 mb-2">
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
                        <div className="flex items-center gap-2 pl-11 pt-1 border-t border-gray-100">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs font-bold text-gray-800">
                            {weekTotal.toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-gray-400">
                            / {weeklyContractHours.toFixed(1)}h
                          </span>
                          <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
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
                      {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayShifts = getShiftsForDay(employee.id, dateStr);
                        const dropId = `cell::${employee.id}::${dateStr}`;

                        return (
                          <DroppableCell key={dateStr} id={dropId} isToday={isToday(day)}>
                            <div className="space-y-1 min-h-[40px]">
                              {dayShifts.map((shift) => (
                                <DraggableShift
                                  key={shift.id}
                                  shift={shift}
                                  isAdmin={isAdmin}
                                  onClick={(e) => handleShiftClick(shift, e)}
                                  copyMode={copyMode}
                                />
                              ))}
                              {isAdmin && (
                                <button
                                  onClick={() => handleAddShiftToCell(employee.id, dateStr)}
                                  className="w-full py-1 rounded-lg border border-dashed border-gray-200 text-gray-300 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50/50 transition-all text-xs flex items-center justify-center gap-1"
                                  title="Ajouter un shift"
                                >
                                  <i className="fas fa-plus text-[10px]"></i>
                                </button>
                              )}
                            </div>
                          </DroppableCell>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-400 rounded-lg px-3 py-2 shadow-xl opacity-90 cursor-grabbing">
              {(() => {
                const shift = shifts.find((s) => s.id === activeId);
                if (!shift) return null;
                return (
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      {shift.startTime} - {shift.endTime}
                    </p>
                    <p className="text-amber-600 text-xs">{shift.role}</p>
                    {copyMode && (
                      <p className="text-blue-600 text-[10px] font-bold mt-1">
                        <i className="fas fa-copy mr-1"></i>COPIE
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="font-semibold text-gray-800 text-sm">
              {contextMenu.shift.startTime} - {contextMenu.shift.endTime}
            </p>
            <p className="text-xs text-gray-500">{contextMenu.shift.role}</p>
          </div>
          <button
            onClick={() => {
              setEditingShift(contextMenu.shift);
              setShowAddModal(true);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <i className="fas fa-edit text-amber-500 w-4"></i>
            Modifier
          </button>
          <button
            onClick={() => {
              const shift = contextMenu.shift;
              const newShift: Shift = {
                ...shift,
                id: `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              };
              onUpdateShifts([...shifts, newShift]);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <i className="fas fa-copy text-blue-500 w-4"></i>
            Dupliquer
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => handleDeleteShift(contextMenu.shift.id)}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <i className="fas fa-trash w-4"></i>
            Supprimer
          </button>
        </div>
      )}

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

// Droppable Cell Component
function DroppableCell({ id, children, isToday }: { id: string; children: React.ReactNode; isToday: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      className={`px-2 py-2 text-center transition-colors ${
        isToday ? 'bg-amber-50/30' : ''
      } ${isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
    >
      {children}
    </td>
  );
}

// Draggable Shift Component
function DraggableShift({ shift, isAdmin, onClick, copyMode }: { 
  shift: Shift; 
  isAdmin: boolean; 
  onClick: (e: React.MouseEvent) => void;
  copyMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    disabled: !isAdmin,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isAdmin ? listeners : {})}
      {...(isAdmin ? attributes : {})}
      onClick={onClick}
      className={`group relative bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs transition-all ${
        isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-30 scale-95' : 'hover:shadow-sm hover:border-amber-300'}`}
    >
      <p className="font-semibold text-amber-800">
        {shift.startTime} - {shift.endTime}
      </p>
      <p className="text-amber-600 text-[10px]">{shift.role}</p>
      {isAdmin && (
        <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(e);
            }}
            className="w-4 h-4 bg-amber-500 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-amber-600"
            title="Modifier / Supprimer"
          >
            <i className="fas fa-ellipsis-h text-[6px]"></i>
          </button>
        </div>
      )}
      {copyMode && isAdmin && (
        <div className="absolute top-0.5 left-0.5">
          <i className="fas fa-copy text-blue-400 text-[8px]"></i>
        </div>
      )}
    </div>
  );
}

// Shift Modal
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
      id: shift?.id || `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
