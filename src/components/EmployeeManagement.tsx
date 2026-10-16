import { useState } from 'react';
import { Employee } from '../types';
import { generateId } from '../data';
import { format } from 'date-fns';

interface EmployeeManagementProps {
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
}

export default function EmployeeManagement({ employees, onUpdateEmployees }: EmployeeManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');

  const departments = [...new Set(employees.map(e => e.department))];

  const filteredEmployees = employees.filter(e => {
    const matchSearch = `${e.firstName} ${e.lastName} ${e.email} ${e.position}`
      .toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = filterDepartment === 'all' || e.department === filterDepartment;
    return matchSearch && matchDept;
  });

  const handleSave = (employee: Employee) => {
    const existing = employees.findIndex(e => e.id === employee.id);
    if (existing >= 0) {
      const updated = [...employees];
      updated[existing] = employee;
      onUpdateEmployees(updated);
    } else {
      onUpdateEmployees([...employees, { ...employee, id: generateId() }]);
    }
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cet employe ?')) {
      onUpdateEmployees(employees.filter(e => e.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    onUpdateEmployees(employees.map(e => e.id === id ? { ...e, active: !e.active } : e));
  };

  const deptColors: Record<string, string> = {
    'Bar': 'var(--yellow)', 'Sécurité': 'var(--peach)', 'Accueil/Caisse': 'var(--green)',
    'DJ/Animation': 'var(--violet)', 'Direction': 'var(--blue)', 'Vestiaire': 'var(--yellow)',
    'Ménage/Entretien': 'var(--peach)',
  };

  return (
    <div style={{ padding: '26px 26px', background: 'var(--surface)', minHeight: '100%', animation: 'contentIn 500ms var(--ease-out) 250ms both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>Employes</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3 }}>{employees.filter(e => e.active).length} actifs</p>
        </div>
        <button onClick={() => { setEditingEmployee(null); setShowForm(true); }} style={{
          fontSize: 12, fontWeight: 600, color: 'var(--panel)',
          background: 'var(--text)', border: 'none',
          borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
        }}>
          + Nouvel employe
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.8" width="15" height="15"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" placeholder="Rechercher..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8,
              border: '1px solid var(--border-2)', fontSize: 13, outline: 'none', background: 'white',
              transition: 'border-color 150ms ease',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--text)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
          />
        </div>
        <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)',
          fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer',
        }}>
          <option value="all">Tous</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 140px',
          gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--border)',
        }}>
          {['Employe', 'Departement', 'Contrat', 'Taux', 'Actions'].map(h => (
            <span key={h} style={{
              fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filteredEmployees.map((emp, i) => (
          <div key={emp.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 140px',
            gap: 8, alignItems: 'center', padding: '12px 20px',
            borderBottom: i < filteredEmployees.length - 1 ? '1px solid var(--border)' : 'none',
            opacity: emp.active ? 1 : 0.5,
            transition: 'background 120ms ease',
            cursor: 'pointer',
            animation: `fadeInUp 350ms var(--ease-out) ${i * 30}ms both`,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: deptColors[emp.department] || 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {emp.firstName[0]}{emp.lastName[0]}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{emp.firstName} {emp.lastName}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.position}</p>
              </div>
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
              background: `${deptColors[emp.department] || 'var(--text-muted)'}18`,
              color: deptColors[emp.department] || 'var(--text-muted)',
            }}>
              {emp.department.split('/')[0]}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.contractType}</span>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {emp.hourlyRate.toFixed(2)}€/h
            </span>
            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <SmallBtn onClick={() => handleToggleActive(emp.id)} color={emp.active ? 'var(--text-muted)' : 'var(--green)'}>
                {emp.active ? 'Desactiver' : 'Activer'}
              </SmallBtn>
              <SmallBtn onClick={() => handleDelete(emp.id)} color="var(--red)">Suppr.</SmallBtn>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Aucun employe trouve</p>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <EmployeeFormModal
          employee={editingEmployee}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingEmployee(null); }}
        />
      )}
    </div>
  );
}

function SmallBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 5,
      border: 'none', background: `${color}12`, color,
      cursor: 'pointer', transition: 'background 150ms ease',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = `${color}22`)}
    onMouseLeave={e => (e.currentTarget.style.background = `${color}12`)}
    >
      {children}
    </button>
  );
}

function EmployeeFormModal({ employee, onSave, onClose }: {
  employee: Employee | null; onSave: (e: Employee) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>(
    employee || {
      firstName: '', lastName: '', email: '', phone: '', position: '',
      department: 'Bar', contractType: 'CDI', startDate: format(new Date(), 'yyyy-MM-dd'),
      hourlyRate: 11.65, monthlyHours: 151.67, socialSecurityNumber: '',
      address: '', postalCode: '', city: '', bankRIB: '', password: '',
      role: 'employee', active: true,
    }
  );

  const handleChange = (field: keyof Employee, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form as Employee);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border-2)', fontSize: 13, outline: 'none', background: 'white',
    transition: 'border-color 150ms ease',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
      animation: 'fadeIn 200ms ease both',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
        animation: 'fadeInUp 300ms var(--ease-out) both',
      }}>
        <div style={{ padding: '24px 28px 0', position: 'sticky', top: 0, background: 'white', borderRadius: '16px 16px 0 0', zIndex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
            {employee ? 'Modifier' : 'Nouvel employe'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Prenom</label><input type="text" value={form.firstName || ''} onChange={e => handleChange('firstName', e.target.value)} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Nom</label><input type="text" value={form.lastName || ''} onChange={e => handleChange('lastName', e.target.value)} style={inputStyle} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Email</label><input type="email" value={form.email || ''} onChange={e => handleChange('email', e.target.value)} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Telephone</label><input type="tel" value={form.phone || ''} onChange={e => handleChange('phone', e.target.value)} style={inputStyle} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Poste</label><input type="text" value={form.position || ''} onChange={e => handleChange('position', e.target.value)} style={inputStyle} required /></div>
            <div>
              <label style={labelStyle}>Departement</label>
              <select value={form.department || 'Bar'} onChange={e => handleChange('department', e.target.value)} style={inputStyle}>
                {['Bar', 'Sécurité', 'Accueil/Caisse', 'Vestiaire', 'DJ/Animation', 'Direction', 'Ménage/Entretien'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Contrat</label>
              <select value={form.contractType || 'CDI'} onChange={e => handleChange('contractType', e.target.value)} style={inputStyle}>
                {['CDI', 'CDD', 'Alternance', 'Stage'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Taux horaire</label><input type="number" step="0.01" value={form.hourlyRate || ''} onChange={e => handleChange('hourlyRate', parseFloat(e.target.value))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Heures/mois</label><input type="number" step="0.01" value={form.monthlyHours || 151.67} onChange={e => handleChange('monthlyHours', parseFloat(e.target.value))} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Date embauche</label><input type="date" value={form.startDate || ''} onChange={e => handleChange('startDate', e.target.value)} style={inputStyle} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Mot de passe</label><input type="password" value={form.password || ''} onChange={e => handleChange('password', e.target.value)} style={inputStyle} required={!employee} placeholder={employee ? 'Inchange' : ''} /></div>
            <div>
              <label style={labelStyle}>Role</label>
              <select value={form.role || 'employee'} onChange={e => handleChange('role', e.target.value)} style={inputStyle}>
                <option value="employee">Employe</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border-2)', background: 'white', color: '#444', cursor: 'pointer',
            }}>Annuler</button>
            <button type="submit" style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', background: '#1a1a1a', color: 'white', cursor: 'pointer',
            }}>{employee ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
