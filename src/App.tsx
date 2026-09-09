import { useState, useEffect } from 'react';
import { Employee, Shift, ViewType } from './types';
import { loadEmployees, saveEmployees, loadShifts, saveShifts } from './data';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Planning from './components/Planning';
import EmployeeManagement from './components/EmployeeManagement';
import PaySlipGenerator from './components/PaySlipGenerator';

function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setEmployees(loadEmployees());
    setShifts(loadShifts());

    // Check for saved session
    const savedUser = localStorage.getItem('hotel_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
      } catch {
        localStorage.removeItem('hotel_current_user');
      }
    }
  }, []);

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('hotel_current_user', JSON.stringify(employee));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('hotel_current_user');
    setCurrentView('dashboard');
  };

  const handleUpdateEmployees = (updated: Employee[]) => {
    setEmployees(updated);
    saveEmployees(updated);
  };

  const handleUpdateShifts = (updated: Shift[]) => {
    setShifts(updated);
    saveShifts(updated);
  };

  if (!currentUser) {
    return <Login employees={employees} onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard employees={employees} shifts={shifts} currentUser={currentUser} />;
      case 'planning':
        return (
          <Planning
            employees={employees}
            shifts={shifts}
            currentUser={currentUser}
            onUpdateShifts={handleUpdateShifts}
          />
        );
      case 'employees':
        return (
          <EmployeeManagement
            employees={employees}
            onUpdateEmployees={handleUpdateEmployees}
          />
        );
      case 'payslips':
        return <PaySlipGenerator employees={employees} shifts={shifts} />;
      default:
        return <Dashboard employees={employees} shifts={shifts} currentUser={currentUser} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-hotel text-white text-sm"></i>
            </div>
            <span className="font-bold text-gray-800">Hôtel Planning</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-gray-600`}></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <nav className="p-3 space-y-1">
              {[
                { id: 'dashboard' as ViewType, label: 'Tableau de bord', icon: 'fas fa-chart-line' },
                { id: 'planning' as ViewType, label: 'Planning', icon: 'fas fa-calendar-alt' },
                ...(currentUser.role === 'admin' ? [
                  { id: 'employees' as ViewType, label: 'Employés', icon: 'fas fa-users' },
                  { id: 'payslips' as ViewType, label: 'Fiches de paie', icon: 'fas fa-file-invoice-dollar' },
                ] : []),
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentView(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${
                    currentView === item.id
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className={`${item.icon} w-5 text-center`}></i>
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-500 hover:bg-red-50"
              >
                <i className="fas fa-sign-out-alt w-5 text-center"></i>
                <span className="font-medium text-sm">Déconnexion</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 mt-14 lg:mt-0">
        <div className="min-h-screen">
          {renderView()}
        </div>
      </div>
    </div>
  );
}

export default App;
