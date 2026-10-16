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
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayShifts = shifts.filter(s => s.date === todayStr);

  const userWeekShifts = shifts.filter(
    s => s.employeeId === currentUser.id && isThisWeek(new Date(s.date), { weekStartsOn: 1 })
  );

  const totalHoursThisWeek = userWeekShifts.reduce((total, shift) => {
    if (shift.status === 'absence_justified' || shift.status === 'absence_unjustified') return total;
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    return total + (hours < 0 ? hours + 24 : hours);
  }, 0);

  const activeEmployees = employees.filter(e => e.active);
  const departments = [...new Set(activeEmployees.map(e => e.department))];

  const absenceCount = userWeekShifts.filter(
    s => s.status === 'absence_justified' || s.status === 'absence_unjustified'
  ).length;

  return (
    <div style={{ padding: '26px 26px', background: 'var(--surface)', minHeight: '100%', animation: 'contentIn 500ms var(--ease-out) 250ms both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Bonjour, {currentUser.firstName}
          </h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3, textTransform: 'capitalize' }}>
            {format(today, 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            }}>+ Shift</button>
            <button style={{
              fontSize: 12, fontWeight: 600, color: 'var(--panel)',
              background: 'var(--text)', border: '1px solid var(--text)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            }}>+ Employe</button>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        border: '1px solid var(--border)', borderRadius: 14,
        overflow: 'hidden', marginBottom: 8, background: 'var(--panel)',
      }}>
        <KpiCell label="Heures semaine" value={`${totalHoursThisWeek.toFixed(1)}h`} color="var(--text)" />
        <KpiCell label="Mes shifts" value={String(userWeekShifts.length)} sub="cette semaine" color="var(--text)" border />
        {isAdmin && <KpiCell label="Employes actifs" value={String(activeEmployees.length)} sub="tous departements" color="var(--green)" border />}
        <KpiCell label="Absences" value={String(absenceCount)} sub="cette semaine" color={absenceCount > 0 ? 'var(--red)' : 'var(--text-dim)'} border />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>

        {/* Tonight's shifts */}
        <Card title="Planning du soir" sub={`${todayShifts.length} shift${todayShifts.length !== 1 ? 's' : ''} prevu${todayShifts.length !== 1 ? 's' : ''}`} link="Voir tout" delay={50}>
          {todayShifts.length > 0 ? todayShifts.map(shift => {
            const emp = employees.find(e => e.id === shift.employeeId);
            if (!emp) return null;
            const isAbsent = shift.status === 'absence_justified' || shift.status === 'absence_unjustified';
            return (
              <Row key={shift.id} style={{ opacity: isAbsent ? 0.5 : 1 }}>
                <Avatar name={`${emp.firstName[0]}${emp.lastName[0]}`} dept={emp.department} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{emp.firstName} {emp.lastName}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {isAbsent ? (
                    <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 500 }}>
                      {shift.status === 'absence_justified' ? 'Abs. justifiee' : 'Absent'}
                    </span>
                  ) : (
                    `${shift.startTime} – ${shift.endTime}`
                  )}
                </span>
              </Row>
            );
          }) : (
            <EmptyState text="Aucun shift ce soir" />
          )}
        </Card>

        {/* My upcoming shifts */}
        <Card title="Mes prochains shifts" sub="cette semaine" link="" delay={100}>
          {userWeekShifts.length > 0 ? (
            Array.from({ length: 7 }).map((_, i) => {
              const date = addDays(weekStart, i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayShifts = userWeekShifts.filter(s => s.date === dateStr);
              if (dayShifts.length === 0) return null;
              return dayShifts.map(shift => (
                <Row key={shift.id}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: isToday(date) ? 'var(--text)' : 'var(--surface-2)',
                    color: isToday(date) ? 'white' : 'var(--text-muted)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.3,
                    flexShrink: 0,
                  }}>
                    <span>{format(date, 'EEE', { locale: fr })}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{format(date, 'd')}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {shift.startTime} – {shift.endTime}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shift.role}</p>
                  </div>
                </Row>
              ));
            })
          ) : (
            <EmptyState text="Aucun shift cette semaine" />
          )}
        </Card>
      </div>

      {/* Departments (admin) */}
      {isAdmin && (
        <Card title="Repartition par departement" sub={`${departments.length} departements`} link="" delay={150} fullWidth>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(departments.length, 5)}, 1fr)`, gap: 8 }}>
            {departments.map(dept => {
              const count = activeEmployees.filter(e => e.department === dept).length;
              const deptColors: Record<string, string> = {
                'Bar': 'var(--yellow)', 'Sécurité': 'var(--peach)', 'Accueil/Caisse': 'var(--green)',
                'DJ/Animation': 'var(--violet)', 'Direction': 'var(--blue)', 'Vestiaire': 'var(--yellow)',
                'Ménage/Entretien': 'var(--peach)',
              };
              const color = deptColors[dept] || 'var(--text-muted)';
              return (
                <div key={dept} style={{
                  padding: '14px 16px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--panel)',
                  transition: 'background 150ms ease, border-color 150ms ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{dept}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function KpiCell({ label, value, sub, color, border }: {
  label: string; value: string; sub?: string; color: string; border?: boolean;
}) {
  return (
    <div style={{
      padding: '22px 24px', cursor: 'pointer',
      borderLeft: border ? '1px solid var(--border)' : 'none',
      transition: 'background 120ms ease',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 10 }}>{label}</p>
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.05em', color, lineHeight: 1 }}>{value}</div>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>{sub}</p>}
    </div>
  );
}

function Card({ title, sub, link, delay, children, fullWidth }: {
  title: string; sub: string; link: string; delay: number; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '22px 24px',
      gridColumn: fullWidth ? '1 / -1' : undefined,
      animation: `fadeInUp 550ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
      transition: 'transform 250ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 250ms ease, border-color 150ms ease',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px) scale(1.005)';
      e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.07)';
      e.currentTarget.style.borderColor = 'var(--border-2)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = 'var(--border)';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>{title}</h2>
        {link && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, cursor: 'pointer' }}>{link} →</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{sub}</p>
      {children}
    </div>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
      marginBottom: 4, cursor: 'pointer',
      transition: 'background 150ms ease, border-color 150ms ease',
      ...style,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {children}
    </div>
  );
}

function Avatar({ name, dept }: { name: string; dept: string }) {
  const deptColors: Record<string, string> = {
    'Bar': 'var(--yellow)', 'Sécurité': 'var(--peach)', 'Accueil/Caisse': 'var(--green)',
    'DJ/Animation': 'var(--violet)', 'Direction': 'var(--blue)', 'Vestiaire': 'var(--yellow)',
    'Ménage/Entretien': 'var(--peach)',
  };
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: deptColors[dept] || 'var(--text-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0, letterSpacing: '-0.02em',
    }}>
      {name}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{text}</p>
    </div>
  );
}
