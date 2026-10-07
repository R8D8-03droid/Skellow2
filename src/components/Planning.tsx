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
  const [contextMenu, setContextMenu] = useState<{ shift: Shift; x: number; y: number; confirmDelete?: boolean } | null>(null);

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

  const handleUpdateShiftStatus = (shiftId: string, status: Shift['status']) => {
    const updated = shifts.map((s) =>
      s.id === shiftId ? { ...s, status } : s
    );
    onUpdateShifts(updated);
    setContextMenu(null);
  };

  const handleDeleteShift = (shiftId: string) => {
    onUpdateShifts(shifts.filter((s) => s.id !== shiftId));
    setContextMenu(null);
  };

  const handleRequestDelete = (shift: Shift) => {
    setContextMenu({ ...contextMenu!, shift, confirmDelete: true });
  };

  const handleCancelDelete = () => {
    if (contextMenu) {
      setContextMenu({ ...contextMenu, confirmDelete: false });
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

  const handleDragStart = (event: DragStartEvent) => {
    if (!isAdmin) return;
    const shiftId = event.active.id as string;
    setActiveId(shiftId);
    setContextMenu(null); // Fermer le menu si ouvert
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
            <i className="fas fa-calendar-alt text-purple-500"></i>
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
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500"
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
            className="px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
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
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-medium rounded-xl shadow hover:shadow-lg transition-all"
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
            <span className="font-medium">⠿ Glissez</span> la poignée à gauche d'un shift pour le déplacer. 
            Activez le <span className="font-medium">mode copie</span> pour dupliquer au lieu de déplacer. 
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
                        isToday(day) ? 'bg-purple-50 text-purple-700' : 'text-gray-500'
                      }`}
                    >
                      <div>{format(day, 'EEE', { locale: fr })}</div>
                      <div className={`text-lg font-bold ${isToday(day) ? 'text-purple-600' : 'text-gray-800'}`}>
                        {format(day, 'd')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.map((employee) => {
                  // Calcul du total hebdomadaire (exclut les absences)
                  let weekTotal = 0;
                  let absenceCount = 0;
                  days.forEach((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayShifts = getShiftsForDay(employee.id, dateStr);
                    dayShifts.forEach((s) => {
                      // Ne compter que les shifts présents ou programmés
                      if (s.status !== 'absence_justified' && s.status !== 'absence_unjustified') {
                        weekTotal += calculateHours(s.startTime, s.endTime);
                      } else {
                        absenceCount++;
                      }
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
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
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
                          {absenceCount > 0 && (
                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              {absenceCount} abs.
                            </span>
                          )}
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
                                  className="w-full py-1 rounded-lg border border-dashed border-gray-200 text-gray-300 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/50 transition-all text-xs flex items-center justify-center gap-1"
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
            <div className="bg-gradient-to-r from-purple-100 to-violet-100 border-2 border-purple-400 rounded-lg px-3 py-2 shadow-xl opacity-90 cursor-grabbing">
              {(() => {
                const shift = shifts.find((s) => s.id === activeId);
                if (!shift) return null;
                return (
                  <div>
                    <p className="font-semibold text-purple-800 text-sm">
                      {shift.startTime} - {shift.endTime}
                    </p>
                    <p className="text-purple-600 text-xs">{shift.role}</p>
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
          className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!contextMenu.confirmDelete ? (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="font-semibold text-gray-800 text-sm">
                  {contextMenu.shift.startTime} - {contextMenu.shift.endTime}
                </p>
                <p className="text-xs text-gray-500">{contextMenu.shift.role}</p>
              </div>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setEditingShift(contextMenu.shift);
                  setShowAddModal(true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-edit text-purple-500 w-4"></i>
                Modifier
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const shift = contextMenu.shift;
                  const newShift: Shift = {
                    ...shift,
                    id: `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  };
                  onUpdateShifts([...shifts, newShift]);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-copy text-blue-500 w-4"></i>
                Dupliquer
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase">Statut</p>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleUpdateShiftStatus(contextMenu.shift.id, 'scheduled')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  contextMenu.shift.status === 'scheduled' || !contextMenu.shift.status ? 'text-purple-600 font-medium' : 'text-gray-700'
                }`}
              >
                <i className="fas fa-calendar-check text-purple-500 w-4"></i>
                Programmé
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleUpdateShiftStatus(contextMenu.shift.id, 'present')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  contextMenu.shift.status === 'present' ? 'text-green-600 font-medium' : 'text-gray-700'
                }`}
              >
                <i className="fas fa-user-check text-green-500 w-4"></i>
                Présent
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleUpdateShiftStatus(contextMenu.shift.id, 'absence_justified')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  contextMenu.shift.status === 'absence_justified' ? 'text-orange-600 font-medium' : 'text-gray-700'
                }`}
              >
                <i className="fas fa-file-medical text-orange-500 w-4"></i>
                Absence justifiée
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleUpdateShiftStatus(contextMenu.shift.id, 'absence_unjustified')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  contextMenu.shift.status === 'absence_unjustified' ? 'text-red-600 font-medium' : 'text-gray-700'
                }`}
              >
                <i className="fas fa-exclamation-triangle text-red-500 w-4"></i>
                Absence injustifiée
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleRequestDelete(contextMenu.shift)}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <i className="fas fa-trash w-4"></i>
                Supprimer
              </button>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-800 text-sm">
                  Confirmer la suppression ?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {contextMenu.shift.startTime} - {contextMenu.shift.endTime}
                </p>
              </div>
              <div className="p-2 flex gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleCancelDelete}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleDeleteShift(contextMenu.shift.id)}
                  className="flex-1 px-3 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg font-medium"
                >
                  Supprimer
                </button>
              </div>
            </>
          )}
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
        isToday ? 'bg-purple-50/30' : ''
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

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClick(e);
  };

  const handleButtonPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // Déterminer les styles selon le statut
  const getStatusStyles = () => {
    switch (shift.status) {
      case 'absence_justified':
        return {
          bg: 'bg-gradient-to-r from-orange-50 to-amber-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          subtext: 'text-orange-600',
          handle: 'bg-orange-200/50 hover:bg-orange-300/70',
          handleIcon: 'text-orange-600',
          icon: 'fas fa-file-medical',
          label: 'Abs. justifiée'
        };
      case 'absence_unjustified':
        return {
          bg: 'bg-gradient-to-r from-red-50 to-rose-50',
          border: 'border-red-200',
          text: 'text-red-800',
          subtext: 'text-red-600',
          handle: 'bg-red-200/50 hover:bg-red-300/70',
          handleIcon: 'text-red-600',
          icon: 'fas fa-exclamation-triangle',
          label: 'Abs. injustifiée'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-purple-50 to-violet-50',
          border: 'border-purple-200',
          text: 'text-purple-800',
          subtext: 'text-purple-600',
          handle: 'bg-purple-200/50 hover:bg-purple-300/70',
          handleIcon: 'text-purple-600',
          icon: null,
          label: null
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex items-stretch ${styles.bg} border ${styles.border} rounded-lg text-xs transition-all ${
        isDragging ? 'opacity-30 scale-95' : 'hover:shadow-sm'
      }`}
    >
      {/* Drag Handle (admin only) */}
      {isAdmin && (
        <div
          {...listeners}
          {...attributes}
          className={`flex items-center justify-center w-5 ${styles.handle} rounded-l-lg cursor-grab active:cursor-grabbing transition-colors touch-none select-none`}
          title="Glisser pour déplacer"
        >
          <i className={`fas fa-grip-vertical ${styles.handleIcon} text-[9px]`}></i>
        </div>
      )}
      
      {/* Shift Content (clickable) */}
      <div
        onClick={onClick}
        onPointerDown={(e) => {
          // Empêcher le drag quand on clique sur le contenu
          if (isAdmin) {
            e.stopPropagation();
          }
        }}
        className={`flex-1 px-2 py-1.5 cursor-pointer ${isAdmin ? 'rounded-r-lg' : 'rounded-lg'}`}
      >
        <p className={`font-semibold ${styles.text}`}>
          {shift.startTime} - {shift.endTime}
        </p>
        <p className={`${styles.subtext} text-[10px] flex items-center gap-1`}>
          {styles.icon && <i className={`${styles.icon} text-[8px]`}></i>}
          {styles.label || shift.role}
        </p>
      </div>

      {/* Action Button (admin only) */}
      {isAdmin && (
        <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onPointerDown={handleButtonPointerDown}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={handleButtonClick}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-5 h-5 bg-purple-500 text-white rounded-full text-[9px] flex items-center justify-center hover:bg-purple-600 shadow-md z-20 relative"
            title="Modifier / Supprimer"
          >
            <i className="fas fa-ellipsis-h text-[7px]"></i>
          </button>
        </div>
      )}

      {/* Copy Mode Indicator */}
      {copyMode && isAdmin && (
        <div className="absolute top-0.5 left-5">
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              placeholder="Ex: Barman, Agent de sécurité..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              placeholder="Remplacement, soirée spéciale..."
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
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
