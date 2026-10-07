import { ViewType, Employee } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  currentUser: Employee;
  onLogout: () => void;
}

export default function Sidebar({ currentView, setCurrentView, currentUser, onLogout }: SidebarProps) {
  const isAdmin = currentUser.role === 'admin';

  const menuItems = [
    { id: 'dashboard' as ViewType, label: 'Tableau de bord', icon: 'fas fa-chart-line', adminOnly: false },
    { id: 'planning' as ViewType, label: 'Planning', icon: 'fas fa-calendar-alt', adminOnly: false },
    { id: 'employees' as ViewType, label: 'Employés', icon: 'fas fa-users', adminOnly: true },
    { id: 'payslips' as ViewType, label: 'Fiches de paie', icon: 'fas fa-file-invoice-dollar', adminOnly: true },
  ];

  return (
    <div className="w-64 bg-gradient-to-b from-gray-900 to-gray-800 min-h-screen flex flex-col shadow-2xl">
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
            <i className="fas fa-hotel text-white"></i>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Hôtel</h1>
            <p className="text-amber-400 text-xs font-medium">Restaurant & Spa</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className={`${item.icon} w-5 text-center`}></i>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
      </nav>

      <div className="p-4 border-t border-gray-700/50">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {currentUser.firstName[0]}{currentUser.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="text-gray-500 text-xs">{currentUser.position}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-sm"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
