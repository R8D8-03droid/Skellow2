import { useState, useEffect, useMemo } from 'react';
import { Employee, Shift } from '../types';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PlanningProps {
  employees: Employee[];
  shifts: Shift[];
  currentUser: Employee;
  onUpdateShifts: (shifts: Shift[]) => void;
}

const HOUR_HEIGHT = 64;
const START_HOUR = 18; // 18:00
const END_HOUR = 7;   // 07:00 next day (13 hours total)
const TOTAL_HOURS = 13;

const SHIFT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'DJ/Animation': { bg: 'var(--violet-bg)', color: 'var(--violet)', border: 'var(--violet-border)' },
  'Bar': { bg: 'var(--yellow-bg)', color: 'var(--yellow)', border: 'var(--yellow-border)' },
  'Sécurité': { bg: 'var(--peach-bg)', color: 'var(--peach)', border: 'var(--peach-border)' },
  'Accueil/Caisse': { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
  'Direction': { bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)' },
  'Vestiaire': { bg: 'var(--yellow-bg)', color: 'var(--yellow)', border: 'var(--yellow-border)' },
  'Ménage/Entretien': { bg: 'var(--peach-bg)', color: 'var(--peach)', border: 'var(--peach-border)' },
};

function getShiftColor(department: string) {
  return SHIFT_COLORS[department] || { bg: 'var(--violet-bg)', color: 'var(--violet)', border: 'var(--violet-border)' };
}

function timeToOffset(time: string): number {
  const [h, m] = time.split(':').map(Number);
  let hourOffset = h - START_HOUR;
  if (hourOffset < 0) hourOffset += 24;
  return (hourOffset + m / 60) * HOUR_HEIGHT;
}

function shiftDuration(start: string, end: string): number {
  const startOffset = timeToOffset(start);
  const endOffset = timeToOffset(end);
  if (endOffset <= startOffset) return (TOTAL_HOURS * HOUR_HEIGHT) - startOffset + endOffset;
  return endOffset - startOffset;
}

export default function Planning({ employees, shifts, currentUser, onUpdateShifts }: PlanningProps) {
  const isAdmin = currentUser.role === 'admin';
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  const hours = Array.from({ length: TOTAL_HOURS }).map((_, i) => {
    const h = (START_HOUR + i) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  });

  const activeEmployees = employees.filter(e => e.active);
  const departments = [...new Set(activeEmployees.map(e => e.department))];

  // Group shifts by day with employee info
  const dayShifts = useMemo(() => {
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayS = shifts.filter(s => s.date === dateStr);

      // Filter by department if needed
      if (selectedDept !== 'all') {
        return dayS.filter(s => {
          const emp = employees.find(e => e.id === s.employeeId);
          return emp?.department === selectedDept;
        });
      }
      return dayS;
    });
  }, [days, shifts, employees, selectedDept]);

  // Current time indicator position
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  let timeOffset = (nowHour - START_HOUR) * HOUR_HEIGHT + (nowMin / 60) * HOUR_HEIGHT;
  if (timeOffset < 0) timeOffset += 24 * HOUR_HEIGHT;
  const showTimeIndicator = timeOffset >= 0 && timeOffset <= TOTAL_HOURS * HOUR_HEIGHT;

  const todayStr = format(now, 'yyyy-MM-dd');
  const todayDayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);

  const handleShiftClick = (shift: Shift) => {
    if (!isAdmin) return;
    setEditingShift(shift);
    setShowAddModal(true);
  };

  const handleSaveShift = (shift: Shift) => {
    const existing = shifts.findIndex(s => s.id === shift.id);
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

  const handleDeleteShift = (shiftId: string) => {
    onUpdateShifts(shifts.filter(s => s.id !== shiftId));
    setShowAddModal(false);
    setEditingShift(null);
  };

  return (
    <div style={{ padding: '24px 28px', animation: 'contentIn 500ms var(--ease-out) 250ms both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)',
                background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#666',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {format(currentWeekStart, 'dd', { locale: fr })}–{format(addDays(currentWeekStart, 6), 'dd MMMM yyyy', { locale: fr })}
            </h1>
            <button
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)',
                background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#666',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pill active={selectedDept === 'all'} onClick={() => setSelectedDept('all')} checkmark>
              Tous
            </Pill>
            {departments.map(dept => (
              <Pill key={dept} active={selectedDept === dept} onClick={() => setSelectedDept(dept)}>
                {dept.split('/')[0]}
              </Pill>
            ))}
            <Pill active={false} onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Cette sem. <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </Pill>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border-2)', background: 'white', color: '#444',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtrer
          </button>
          {isAdmin && (
            <button
              onClick={() => { setEditingShift(null); setShowAddModal(true); }}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: 'none', background: '#1a1a1a', color: 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              + Ajouter shift
            </button>
          )}
        </div>
      </div>

      {/* Schedule grid */}
      <div style={{
        display: 'flex', overflow: 'hidden',
        border: '1px solid var(--border)', borderRadius: 16,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 0 0 1px rgba(255,255,255,0.6) inset',
      }}>
        {/* Time column */}
        <div style={{ width: 56, flexShrink: 0, paddingTop: 40 }}>
          {hours.map(h => (
            <div key={h} style={{
              height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
              paddingRight: 12, fontSize: 11, color: 'var(--text-dim)', fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, overflowX: 'auto' }}>
          {days.map((day, dayIndex) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurrentDay = isToday(day);
            const shiftsForDay = dayShifts[dayIndex] || [];

            return (
              <div key={dateStr} style={{ borderLeft: dayIndex > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none', minWidth: 0 }}>
                {/* Day header */}
                <div style={{
                  height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: isCurrentDay ? 600 : 500,
                  color: isCurrentDay ? 'white' : '#999',
                  background: isCurrentDay ? '#1a1a1a' : 'transparent',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  gap: 4,
                  transition: 'background 200ms ease, color 200ms ease',
                }}>
                  {format(day, 'd')} – {format(day, 'EEE', { locale: fr })}
                </div>

                {/* Day body */}
                <div style={{ position: 'relative' }}>
                  {/* Hour slots */}
                  {hours.map(h => (
                    <div key={h} style={{
                      height: HOUR_HEIGHT,
                      borderBottom: '1px solid rgba(0,0,0,0.035)',
                      cursor: isAdmin ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (!isAdmin) return;
                      const employee = employees.find(e => e.active);
                      if (!employee) return;
                      setEditingShift({
                        id: '',
                        employeeId: employee.id,
                        date: dateStr,
                        startTime: h,
                        endTime: `${String((parseInt(h) + 8) % 24).padStart(2, '0')}:00`,
                        role: employee.position || '',
                      });
                      setShowAddModal(true);
                    }}
                    />
                  ))}

                  {/* Shift blocks */}
                  {shiftsForDay.map((shift, si) => {
                    const emp = employees.find(e => e.id === shift.employeeId);
                    if (!emp) return null;
                    const colors = getShiftColor(emp.department);
                    const top = timeToOffset(shift.startTime);
                    const height = shiftDuration(shift.startTime, shift.endTime);

                    // Simple overlap: count shifts that overlap and offset
                    const overlapping = shiftsForDay.filter((s, idx) => {
                      if (idx >= si) return false;
                      const sTop = timeToOffset(s.startTime);
                      const sH = shiftDuration(s.startTime, s.endTime);
                      return top < sTop + sH && top + height > sTop;
                    });
                    const overlapIndex = overlapping.length;
                    const totalOverlaps = shiftsForDay.filter(s => {
                      if (s.id === shift.id) return false;
                      const sTop = timeToOffset(s.startTime);
                      const sH = shiftDuration(s.startTime, s.endTime);
                      return top < sTop + sH && top + height > sTop;
                    }).length + 1;

                    const width = totalOverlaps > 1 ? `${100 / totalOverlaps}%` : 'calc(100% - 8px)';
                    const left = totalOverlaps > 1 ? `${(overlapIndex / totalOverlaps) * 100}%` : '4px';

                    const isAbsent = shift.status === 'absence_justified' || shift.status === 'absence_unjustified';

                    return (
                      <div
                        key={shift.id}
                        onClick={(e) => { e.stopPropagation(); handleShiftClick(shift); }}
                        style={{
                          position: 'absolute',
                          top, height: Math.max(height, 32),
                          left, width,
                          paddingLeft: totalOverlaps > 1 ? 2 : 0,
                          paddingRight: totalOverlaps > 1 ? 2 : 0,
                          animation: `shiftIn 400ms var(--ease-out-expo) ${350 + si * 50}ms both`,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 10, padding: '8px 10px',
                            fontSize: 11, overflow: 'hidden',
                            cursor: 'pointer',
                            background: colors.bg, color: colors.color,
                            border: `1px solid ${colors.border}`,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            opacity: isAbsent ? 0.5 : 1,
                            transition: 'transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>
                            {emp.firstName} {emp.lastName.charAt(0)}.
                          </div>
                          <div style={{ opacity: 0.65, fontSize: 10 }}>
                            {shift.startTime} – {shift.endTime}
                          </div>
                          {shift.status === 'present' && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10, fontWeight: 600, marginTop: 4,
                            }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="9 12 11 14 15 10" fill="none" stroke="white" strokeWidth="2.5"/>
                              </svg>
                              Confirmee
                            </div>
                          )}
                          {isAbsent && (
                            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, opacity: 0.8 }}>
                              {shift.status === 'absence_justified' ? 'Abs. justifiee' : 'Abs. injustifiee'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Time indicator (only on today's column) */}
                  {isCurrentDay && showTimeIndicator && (
                    <div style={{
                      position: 'absolute', top: timeOffset, left: -4, right: 0,
                      display: 'flex', alignItems: 'center', zIndex: 10,
                      animation: 'fadeIn 500ms var(--ease-out) 600ms both',
                    }}>
                      <span style={{
                        background: '#1a1a1a', color: 'white',
                        fontSize: 10, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 6,
                        whiteSpace: 'nowrap', flexShrink: 0,
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute', left: -3, top: '50%', transform: 'translateY(-50%)',
                          width: 7, height: 7, borderRadius: '50%', background: '#1a1a1a',
                          animation: 'timeDotPulse 2s ease-in-out infinite',
                        }} />
                        {String(nowHour).padStart(2, '0')}:{String(nowMin).padStart(2, '0')}
                      </span>
                      <span style={{ flex: 1, height: 2, background: '#1a1a1a' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ShiftModal
          shift={editingShift}
          employees={activeEmployees}
          onSave={handleSaveShift}
          onDelete={editingShift?.id ? () => handleDeleteShift(editingShift.id) : undefined}
          onClose={() => { setShowAddModal(false); setEditingShift(null); }}
        />
      )}
    </div>
  );
}

// ── Pill component ──
function Pill({ active, onClick, children, checkmark }: {
  active: boolean; onClick: () => void; children: React.ReactNode; checkmark?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 100,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${active ? '#1a1a1a' : 'rgba(0,0,0,0.1)'}`,
        background: active ? '#1a1a1a' : 'white',
        color: active ? 'white' : '#666',
        display: 'flex', alignItems: 'center', gap: 4,
        transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease, transform 100ms var(--ease-out)',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.22)';
          e.currentTarget.style.color = '#333';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
          e.currentTarget.style.color = '#666';
        }
      }}
    >
      {checkmark && active && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {children}
    </div>
  );
}

// ── Shift Modal ──
function ShiftModal({ shift, employees, onSave, onDelete, onClose }: {
  shift: Shift | null;
  employees: Employee[];
  onSave: (shift: Shift) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(shift?.employeeId || employees[0]?.id || '');
  const [date, setDate] = useState(shift?.date || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(shift?.startTime || '22:00');
  const [endTime, setEndTime] = useState(shift?.endTime || '05:00');
  const [role, setRole] = useState(shift?.role || '');
  const [notes, setNotes] = useState(shift?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: shift?.id || `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      employeeId, date, startTime, endTime, role, notes,
      status: shift?.status,
    });
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border-2)', fontSize: 13,
    outline: 'none', transition: 'border-color 150ms ease',
    background: 'white',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
        animation: 'fadeIn 200ms ease both',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 16, width: '100%', maxWidth: 420,
          padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
          animation: 'fadeInUp 300ms var(--ease-out) both',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, letterSpacing: '-0.02em' }}>
          {shift?.id ? 'Modifier le shift' : 'Nouveau shift'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Employe</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={inputStyle}>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Debut</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Fin</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} required />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Poste</label>
            <input type="text" value={role} onChange={e => setRole(e.target.value)} style={inputStyle} placeholder="Barman, DJ..." required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} placeholder="Optionnel" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {onDelete && (
              <button
                type="button"
                onClick={() => { if (confirm('Supprimer ce shift ?')) onDelete(); }}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(217,48,37,0.2)', background: 'rgba(217,48,37,0.06)',
                  color: '#d93025', cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border-2)', background: 'white', color: '#444', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="submit" style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', background: '#1a1a1a', color: 'white', cursor: 'pointer',
            }}>
              {shift?.id ? 'Enregistrer' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
