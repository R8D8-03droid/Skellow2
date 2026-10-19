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
  KeyRound,
  Plus,
} from "lucide-react";
import { CurrentUser, Employee, ViewType } from "../types";
import type { Restaurant } from "../backend/account";
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
  { id: "access" as ViewType, label: "Accès", icon: KeyRound },
];
interface Props {
  mode: "demo" | "supabase";
  restaurant?: Restaurant;
  restaurants: Restaurant[];
  owner: boolean;
  onSelectRestaurant: (id: string) => void;
  onCreateRestaurant: () => void;
  disabled: boolean;
  mobileOpen: boolean;
  currentView: ViewType;
  onNavigate: (view: ViewType, department?: string) => void;
  currentUser: CurrentUser;
  employees: Employee[];
  onLogout: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onClose: () => void;
  collapsed: boolean;
}
export default function Sidebar({
  mode, restaurant, restaurants, owner, onSelectRestaurant, onCreateRestaurant, disabled,
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
        <span className="workspace-symbol">{restaurant?.name.slice(0, 1).toUpperCase() || "N"}</span>
        <div>
          {mode === "supabase" ? <><label className="sr-only" htmlFor="restaurant-selector">Établissement</label><select id="restaurant-selector" className="restaurant-selector" value={restaurant?.id || ''} disabled={disabled} onChange={e => onSelectRestaurant(e.target.value)}>{restaurants.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select><span>Votre établissement</span></> : <><strong>Night Club</strong><span>Espace de démonstration</span></>}
        </div>
        <span className="workspace-status" title={mode === "supabase" ? "Espace partagé" : "Démo locale"} />
      </div>
      {mode === "supabase" && <button className="create-restaurant" disabled={disabled} onClick={onCreateRestaurant} title="Ajouter un établissement"><Plus size={14}/><span>Ajouter un établissement</span></button>}
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
                n.id === "access" ? owner : currentUser.role === "admin" ||
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
