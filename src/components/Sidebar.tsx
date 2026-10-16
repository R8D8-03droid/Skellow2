import { ViewType, Employee } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  currentUser: Employee;
  onLogout: () => void;
}

const navItems = [
  {
    id: 'dashboard' as ViewType,
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    adminOnly: false,
  },
  {
    id: 'employees' as ViewType,
    label: 'Employes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    adminOnly: true,
  },
  {
    id: 'planning' as ViewType,
    label: 'Planning',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    adminOnly: false,
  },
  {
    id: 'payslips' as ViewType,
    label: 'Fiches de paie',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    adminOnly: true,
  },
];

export default function Sidebar({ currentView, setCurrentView, currentUser, onLogout }: SidebarProps) {
  const isAdmin = currentUser.role === 'admin';

  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="app-sidebar">
      {/* Logo + collapse */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, padding: '0 4px',
        animation: 'fadeIn 400ms var(--ease-out) 100ms both',
      }}>
        <div style={{
          width: 36, height: 36, background: '#1a1a1a', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          cursor: 'pointer',
          transition: 'transform 200ms var(--ease-out)',
        }}>
          <span style={{ width: 5, height: 5, background: 'white', borderRadius: '50%' }} />
          <span style={{ width: 4, height: 4, background: 'white', borderRadius: '50%' }} />
          <span style={{ width: 4, height: 4, background: 'white', borderRadius: '50%' }} />
        </div>
        <button style={{
          width: 28, height: 28, borderRadius: 6,
          border: '1px solid rgba(0,0,0,0.1)', background: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#999',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>
      </div>

      {/* Main nav */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: '#aaa',
          padding: '0 8px', marginBottom: 6, letterSpacing: '0.01em',
          animation: 'fadeIn 400ms var(--ease-out) 150ms both',
        }}>
          Main menu
        </div>
        {filteredItems.map((item, i) => (
          <NavItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={currentView === item.id}
            onClick={() => setCurrentView(item.id)}
            delay={100 + i * 40}
          />
        ))}

        <NavItem
          label="Messages"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
          active={false}
          onClick={() => {}}
          delay={100 + filteredItems.length * 40}
          badge={2}
        />

        <NavItem
          label="Statistiques"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
            </svg>
          }
          active={false}
          onClick={() => {}}
          delay={100 + (filteredItems.length + 1) * 40}
        />
      </div>

      {/* Settings section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: '#aaa',
          padding: '0 8px', marginBottom: 6, letterSpacing: '0.01em',
        }}>
          Parametres
        </div>
        <NavItem
          label="Reglages"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          }
          active={false}
          onClick={() => {}}
          delay={400}
        />
      </div>

      {/* Account + logout */}
      <div style={{
        marginTop: 'auto', paddingTop: 16,
        borderTop: '1px solid var(--border)',
        animation: 'fadeIn 400ms var(--ease-out) 500ms both',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8, marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#e8e4df', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#666',
          }}>
            {currentUser.firstName[0]}{currentUser.lastName[0]}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {currentUser.position}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 10px', borderRadius: 8,
            fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
            border: 'none', background: 'none', cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(217,48,37,0.06)';
            e.currentTarget.style.color = '#d93025';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Deconnexion
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  label, icon, active, onClick, delay, badge,
}: {
  label: string;
  icon: JSX.Element;
  active: boolean;
  onClick: () => void;
  delay: number;
  badge?: number;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 10,
        fontSize: 13.5, fontWeight: active ? 600 : 500,
        color: active ? '#1a1a1a' : '#666',
        background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 150ms var(--ease-out), color 150ms ease, transform 100ms var(--ease-out)',
        animation: `fadeInUp 350ms var(--ease-out) ${delay}ms both`,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
          e.currentTarget.style.color = '#333';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#666';
        }
      }}
    >
      <div style={{ width: 18, height: 18, flexShrink: 0, opacity: active ? 0.75 : 0.45 }}>
        {icon}
      </div>
      {label}
      {badge !== undefined && (
        <span style={{
          marginLeft: 'auto',
          width: 20, height: 20, borderRadius: '50%',
          background: '#f44', color: 'white', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'badgePulse 2s ease-in-out infinite',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}
