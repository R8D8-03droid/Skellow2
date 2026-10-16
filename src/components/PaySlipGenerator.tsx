import { useState } from 'react';
import { Employee, Shift, PaySlip } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { IDCC_1790_RULES, calculateOvertime, calculateNightHours } from '../idcc1790';

interface PaySlipGeneratorProps {
  employees: Employee[];
  shifts: Shift[];
}

interface GeneratedPaySlip extends PaySlip {
  employee: Employee;
}

export default function PaySlipGenerator({ employees, shifts }: PaySlipGeneratorProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatedSlips, setGeneratedSlips] = useState<GeneratedPaySlip[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  const activeEmployees = employees.filter(e => e.active);

  const calculateMonthlyHours = (employeeId: string, month: number, year: number) => {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    let totalMinutes = 0;
    let nightMinutes = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter(s => s.employeeId === employeeId && s.date === dateStr);
      dayShifts.forEach(shift => {
        if (shift.status === 'absence_justified' || shift.status === 'absence_unjustified') return;
        const [sh, sm] = shift.startTime.split(':').map(Number);
        const [eh, em] = shift.endTime.split(':').map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        totalMinutes += minutes;
        nightMinutes += calculateNightHours(shift.startTime, shift.endTime) * 60;
      });
    });

    const totalHours = totalMinutes / 60;
    const weeksInMonth = getDaysInMonth(new Date(year, month - 1)) / 7;
    const avgWeeklyHours = totalHours / weeksInMonth;
    const overtime = calculateOvertime(avgWeeklyHours);

    return {
      totalHours,
      regularHours: overtime.regular * weeksInMonth,
      overtime25Hours: overtime.overtime25 * weeksInMonth,
      overtime50Hours: overtime.overtime50 * weeksInMonth,
      nightHours: nightMinutes / 60,
    };
  };

  const generatePaySlip = (employee: Employee): GeneratedPaySlip => {
    const { totalHours, regularHours, overtime25Hours, overtime50Hours, nightHours } = calculateMonthlyHours(employee.id, selectedMonth, selectedYear);
    const baseSalary = regularHours * employee.hourlyRate;
    const overtime25Pay = overtime25Hours * employee.hourlyRate * 1.25;
    const overtime50Pay = overtime50Hours * employee.hourlyRate * 1.50;
    const nightBonus = nightHours * IDCC_1790_RULES.nightWorkBonus;
    const grossSalary = baseSalary + overtime25Pay + overtime50Pay + nightBonus;
    const socialCharges = grossSalary * 0.22;
    const netSalary = grossSalary - socialCharges;

    return {
      id: `payslip-${employee.id}-${selectedYear}-${selectedMonth}`,
      employeeId: employee.id, month: selectedMonth, year: selectedYear,
      totalHours, regularHours, overtime25Hours, overtime50Hours, nightHours,
      baseSalary, overtime25Pay, overtime50Pay, nightBonus,
      grossSalary, socialCharges, netSalary,
      generatedAt: new Date().toISOString(), employee,
    };
  };

  const handleGenerate = () => {
    const toProcess = selectedEmployee === 'all' ? activeEmployees : activeEmployees.filter(e => e.id === selectedEmployee);
    setGeneratedSlips(toProcess.map(emp => generatePaySlip(emp)));
  };

  const generateExcel = () => {
    if (generatedSlips.length === 0) return;
    const wb = XLSX.utils.book_new();
    const data = [
      ['Nom', 'Prenom', 'Poste', 'Heures totales', 'Heures normales', 'HS 25%', 'HS 50%', 'Heures nuit', 'Brut', 'Charges', 'Net'],
      ...generatedSlips.map(s => [
        s.employee.lastName, s.employee.firstName, s.employee.position,
        +s.totalHours.toFixed(2), +s.regularHours.toFixed(2), +s.overtime25Hours.toFixed(2),
        +s.overtime50Hours.toFixed(2), +s.nightHours.toFixed(2),
        +s.grossSalary.toFixed(2), +s.socialCharges.toFixed(2), +s.netSalary.toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Paie');
    XLSX.writeFile(wb, `paie_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);
  };

  const months = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)',
    fontSize: 13, outline: 'none', background: 'white', width: '100%',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  };

  const deptColors: Record<string, string> = {
    'Bar': 'var(--yellow)', 'Sécurité': 'var(--peach)', 'Accueil/Caisse': 'var(--green)',
    'DJ/Animation': 'var(--violet)', 'Direction': 'var(--blue)',
  };

  return (
    <div style={{ padding: '26px 26px', background: 'var(--surface)', minHeight: '100%', animation: 'contentIn 500ms var(--ease-out) 250ms both' }}>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>Fiches de paie</h1>
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3 }}>Convention IDCC 1790 — 35h, HS +25%/+50%, nuit +1€/h</p>
      </div>

      {/* Controls */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '20px 24px', marginBottom: 8,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end',
      }}>
        <div>
          <label style={labelStyle}>Mois</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} style={inputStyle}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Annee</label>
          <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} style={inputStyle}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Employe</label>
          <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} style={inputStyle}>
            <option value="all">Tous</option>
            {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
          </select>
        </div>
        <button onClick={handleGenerate} style={{
          padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: 'none', background: '#1a1a1a', color: 'white', cursor: 'pointer',
          height: 37,
        }}>
          Calculer
        </button>
      </div>

      {/* Results */}
      {generatedSlips.length > 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Summary bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <Stat label="Masse brute" value={`${generatedSlips.reduce((s, sl) => s + sl.grossSalary, 0).toFixed(0)}€`} />
              <Stat label="Total charges" value={`${generatedSlips.reduce((s, sl) => s + sl.socialCharges, 0).toFixed(0)}€`} color="var(--peach)" />
              <Stat label="Masse nette" value={`${generatedSlips.reduce((s, sl) => s + sl.netSalary, 0).toFixed(0)}€`} color="var(--green)" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={generateExcel} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--border-2)', background: 'white', color: '#444', cursor: 'pointer',
              }}>Export Excel</button>
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 70px 70px 70px 90px 90px',
            gap: 8, padding: '10px 24px', borderBottom: '1px solid var(--border)',
          }}>
            {['Employe', 'Total h', 'HS 25%', 'HS 50%', 'Nuit', 'Brut', 'Net'].map(h => (
              <span key={h} style={{
                fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {generatedSlips.map((slip, i) => (
            <div key={slip.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 70px 70px 70px 90px 90px',
              gap: 8, alignItems: 'center', padding: '14px 24px',
              borderBottom: i < generatedSlips.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 120ms ease',
              animation: `fadeInUp 350ms var(--ease-out) ${i * 40}ms both`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: deptColors[slip.employee.department] || 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
                }}>{slip.employee.firstName[0]}{slip.employee.lastName[0]}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{slip.employee.firstName} {slip.employee.lastName}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slip.employee.position}</p>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{slip.totalHours.toFixed(1)}h</span>
              <span style={{ fontSize: 12, color: slip.overtime25Hours > 0 ? 'var(--yellow)' : 'var(--text-dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{slip.overtime25Hours.toFixed(1)}h</span>
              <span style={{ fontSize: 12, color: slip.overtime50Hours > 0 ? 'var(--peach)' : 'var(--text-dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{slip.overtime50Hours.toFixed(1)}h</span>
              <span style={{ fontSize: 12, color: slip.nightHours > 0 ? 'var(--violet)' : 'var(--text-dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{slip.nightHours.toFixed(1)}h</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{slip.grossSalary.toFixed(0)}€</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{slip.netSalary.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      )}

      {generatedSlips.length === 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '48px 0', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>Selectionnez un mois et cliquez sur "Calculer"</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: color || 'var(--text)', letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}
