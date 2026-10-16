import { Bell, ChevronRight, PanelLeftOpen, Search, RefreshCw } from "lucide-react";
import { Employee } from "../types";
import { Avatar, IconButton } from "./ui";
interface Props {
  connectionLabel: string;
  connected: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  menuExpanded: boolean;
  viewLabel: string;
  currentUser: Employee;
  onMenu: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  notificationCount: number;
}
export default function Topbar({
  connectionLabel, connected, refreshing, onRefresh,
  menuExpanded,
  viewLabel,
  currentUser,
  onMenu,
  onSearch,
  onNotifications,
  onProfile,
  notificationCount,
}: Props) {
  return (
    <header className="app-topbar">
      <div className="breadcrumb">
        <IconButton
          label="Afficher ou masquer la navigation"
          aria-expanded={menuExpanded}
          aria-controls="main-navigation"
          onClick={onMenu}
        >
          <PanelLeftOpen size={17} />
        </IconButton>
        <span className="breadcrumb-root">Espace de travail</span>
        <ChevronRight size={13} />
        <span>{viewLabel}</span>
      </div>
      <div className="topbar-actions">
        <span className="local-badge">
          <span className="status-dot" />
          {connectionLabel}
        </span>
        {connected && <IconButton label="Actualiser les données" disabled={refreshing} onClick={onRefresh}><RefreshCw size={17} /></IconButton>}
        <IconButton label="Rechercher dans Skellow" onClick={onSearch}>
          <Search size={17} />
        </IconButton>
        <IconButton label="Activité et notifications" onClick={onNotifications}>
          <Bell size={17} />
          {notificationCount > 0 && <span className="notification-dot" />}
        </IconButton>
        <button
          className="profile-button"
          aria-label="Mon compte"
          onClick={onProfile}
        >
          <Avatar employee={currentUser} size="sm" />
        </button>
      </div>
    </header>
  );
}
