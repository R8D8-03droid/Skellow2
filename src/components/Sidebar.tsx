import { CSSProperties } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Settings2,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  ArrowUpRight,
} from "lucide-react";
import { Employee, ViewType } from "../types";
import { Avatar, Brand, IconButton, toneFor } from "./ui";
export const navigation = [
  {
    id: "dashboard" as ViewType,
    label: "Vue d’ensemble",
    icon: LayoutDashboard,
  },
  { id: "planning" as ViewType, label: "Planning", icon: CalendarDays },
  { id: "employees" as ViewType, label: "Équipe", icon: Users },
  { id: "payslips" as ViewType, label: "Préparation de paie", icon: FileText },
];
interface Props {
  mode: "demo" | "supabase";
  mobileOpen: boolean;
  currentView: ViewType;
  onNavigate: (view: ViewType, department?: string) => void;
  currentUser: Employee;
  employees: Employee[];
  onLogout: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onClose: () => void;
  collapsed: boolean;
}
export default function Sidebar({
  mode,
  mobileOpen,
  currentView,
  onNavigate,
  currentUser,
  employees,
  onLogout,
  onSearch,
  onSettings,
  onHelp,
  onClose,
  collapsed,
}: Props) {
  const departments = [
    ...new Set(employees.filter((e) => e.active).map((e) => e.department)),
  ];
  return (
    <aside
      className={`app-sidebar ${collapsed ? "is-collapsed" : ""}`}
      id="main-navigation"
      role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen || undefined}
      aria-label="Navigation principale"
    >
      <div className="sidebar-brand">
        <Brand compact={collapsed} />
        <IconButton label="Réduire la navigation" onClick={onClose}>
          <PanelLeftClose size={16} />
        </IconButton>
      </div>
      <div className="workspace-card">
        <span className="workspace-symbol">N</span>
        <div>
          <strong>Night Club</strong>
          <span>Espace de travail</span>
        </div>
        <span className="workspace-status" title={mode === "supabase" ? "Espace partagé" : "Démo locale"} />
      </div>
      <button className="sidebar-search" onClick={onSearch}>
        <Search size={16} />
        <span>Rechercher</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="sidebar-section">
        <span className="sidebar-label">Votre espace</span>
        <nav
          style={
            {
              "--nav-index": navigation.findIndex((n) => n.id === currentView),
            } as CSSProperties
          }
        >
          <span className="nav-active" aria-hidden="true" />
          {navigation
            .filter(
              (n) =>
                currentUser.role === "admin" ||
                ["dashboard", "planning"].includes(n.id),
            )
            .map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`nav-item ${currentView === item.id ? "active" : ""}`}
                aria-current={currentView === item.id ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "employees" && (
                  <span className="nav-count">
                    {employees.filter((e) => e.active).length}
                  </span>
                )}
              </button>
            ))}
        </nav>
      </div>
      {currentUser.role === "admin" && (
        <div className="sidebar-section department-nav">
          <div className="sidebar-section-title">
            <span className="sidebar-label">Départements</span>
            <span className="small muted">{departments.length}</span>
          </div>
          {departments.map((dept) => (
            <button
              className="nav-item"
              key={dept}
              onClick={() => onNavigate("employees", dept)}
            >
              <span className={`department-dot tone-${toneFor(dept)}`} />
              <span>{dept.split("/")[0]}</span>
              <ArrowUpRight size={13} className="nav-reveal" />
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="status-dot" />
          <span>{mode === "supabase" ? "Un espace partagé pour votre équipe" : "Démonstration sur cet appareil"}</span>
        </div>
        <button
          className="nav-item"
          onClick={onSettings}
          title={collapsed ? "Préférences" : undefined}
        >
          <Settings2 size={17} />
          <span>Préférences</span>
        </button>
        <button
          className="nav-item"
          onClick={onHelp}
          title={collapsed ? "Aide et raccourcis" : undefined}
        >
          <HelpCircle size={17} />
          <span>Aide et raccourcis</span>
        </button>
        <div className="account-row">
          <button onClick={onSettings} className="account-button">
            <Avatar employee={currentUser} size="sm" />
            <span>
              <strong>
                {currentUser.firstName} {currentUser.lastName}
              </strong>
              <small>{currentUser.position}</small>
            </span>
          </button>
          <IconButton label="Se déconnecter" onClick={onLogout}>
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
