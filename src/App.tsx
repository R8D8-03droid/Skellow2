import { useState, useEffect } from 'react';
import { Employee, Shift, ViewType } from './types';
import { loadEmployees, saveEmployees, loadShifts, saveShifts } from './data';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './components/Dashboard';
import Planning from './components/Planning';
import EmployeeManagement from './components/EmployeeManagement';
import PaySlipGenerator from './components/PaySlipGenerator';

function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('planning');

  useEffect(() => {
    const loadedEmployees = loadEmployees();
    const loadedShifts = loadShifts();
    setEmployees(loadedEmployees);
    setShifts(loadedShifts);

    const savedUser = localStorage.getItem('hotel_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        const userExists = loadedEmployees.some(emp => emp.id === user.id);
        if (userExists) {
          setCurrentUser(user);
        } else {
          localStorage.removeItem('hotel_current_user');
        }
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
    setCurrentView('planning');
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

  const viewLabels: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    planning: 'Planning',
    employees: 'Employes',
    payslips: 'Fiches de paie',
  };

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
    <div className="app-shell">
      <Topbar
        currentView={currentView}
        viewLabel={viewLabels[currentView]}
        currentUser={currentUser}
      />
      <div className="app-body">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <main className="app-main">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
