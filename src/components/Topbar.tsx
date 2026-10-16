import { Employee, ViewType } from '../types';

interface TopbarProps {
  currentView: ViewType;
  viewLabel: string;
  currentUser: Employee;
}

const viewIcons: Record<ViewType, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14, opacity: 0.5 }}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  planning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14, opacity: 0.5 }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  employees: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14, opacity: 0.5 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  ),
  payslips: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14, opacity: 0.5 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

export default function Topbar({ currentView, viewLabel, currentUser }: TopbarProps) {
  return (
    <div className="app-topbar">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, background: '#1a1a1a', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
        }}>
          <span style={{ width: 4, height: 4, background: 'white', borderRadius: '50%' }} />
          <span style={{ width: 3.5, height: 3.5, background: 'white', borderRadius: '50%' }} />
          <span style={{ width: 3.5, height: 3.5, background: 'white', borderRadius: '50%' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>
          Skellow
        </span>
      </div>

      {/* Breadcrumb center */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          fontSize: 13, color: 'var(--text-muted)', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
          animation: 'fadeIn 400ms var(--ease-out) 200ms both',
        }}>
          Skellow
          <span style={{ color: 'var(--text-dim)' }}>›</span>
          {viewIcons[currentView]}
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{viewLabel}</strong>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <TopbarIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </TopbarIcon>
        <TopbarIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </TopbarIcon>
        <TopbarIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </TopbarIcon>

        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#e8e4df', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#666', cursor: 'pointer',
          marginLeft: 4,
          transition: 'transform 150ms var(--ease-out)',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {currentUser.firstName[0]}{currentUser.lastName[0]}
        </div>
      </div>
    </div>
  );
}

function TopbarIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 34, height: 34, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#999',
        transition: 'background 150ms ease, color 150ms ease, transform 100ms var(--ease-out)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
        e.currentTarget.style.color = '#555';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#999';
      }}
    >
      <div style={{ width: 18, height: 18 }}>{children}</div>
    </div>
  );
}
