import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Check,
  HelpCircle,
  Command,
  Monitor,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  User,
} from "lucide-react";
import { CurrentUser, Employee, Shift, ViewType } from "./types";
import { useWorkspace } from "./backend/useWorkspace";
import { accountRepository, backendConfig } from "./backend/runtime";
import { errorMessage } from "./backend/contracts";
import LocalImport from "./components/LocalImport";
import Login from "./components/Login";
import RestaurantWelcome from "./components/RestaurantWelcome";
import AccessManagement from "./components/AccessManagement";
import { installMotionPolicy } from "./motion";
import Sidebar, { navigation } from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./components/Dashboard";
import Planning from "./components/Planning";
import EmployeeManagement from "./components/EmployeeManagement";
import PaySlipGenerator from "./components/PaySlipGenerator";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  Toast,
  personName,
} from "./components/ui";
export interface ViewIntent {
  action?: "create";
  employeeId?: string;
  department?: string;
  shiftId?: string;
  date?: string;
  nonce: number;
}
function App() {
  const workspace = useWorkspace();
  const employees = workspace.snapshot?.employees || [];
  const shifts = workspace.snapshot?.shifts || [];
  const account = workspace.snapshot?.account;
  const restaurantId = workspace.snapshot?.restaurantId;
  const restaurants = workspace.snapshot?.restaurants || [];
  const restaurant = restaurants.find(r => r.id === restaurantId);
  const membershipRole = workspace.snapshot?.membershipRole;
  const linkedEmployee = employees.find(e => e.id === workspace.snapshot?.currentEmployeeId && e.active);
  const accountName = (account?.name || account?.email.split('@')[0] || '').trim().split(/\s+/);
  const currentUser: CurrentUser | null = account
    ? membershipRole && restaurantId ? {
      id: linkedEmployee?.id || account.id, firstName: accountName[0], lastName: accountName.slice(1).join(' '),
      email: account.email, department: linkedEmployee?.department || '',
      position: membershipRole === 'owner' ? 'Propriétaire' : membershipRole === 'admin' ? 'Administrateur' : linkedEmployee?.position || 'Salarié',
      role: membershipRole === 'employee' ? 'employee' : 'admin',
    } : null
    : linkedEmployee || null;
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [importing, setImporting] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>("planning");
  const [intent, setIntent] = useState<ViewIntent>({ nonce: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 800px)").matches,
  );
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<
    "search" | "settings" | "help" | "notifications" | null
  >(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [preferences, setPreferences] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("skellow_preferences") || "{}",
      ) as { compact?: boolean; reduceMotion?: boolean };
    } catch {
      return {};
    }
  });
  const closeToast = useCallback(() => setToast(null), []);
  const notify = useCallback(
    (message: string, tone: "success" | "error" = "success") =>
      setToast({ message, tone }),
    [],
  );
  const navigate = useCallback(
    (view: ViewType, details?: Omit<ViewIntent, "nonce">) => {
      setCurrentView(view);
      setIntent({ ...details, nonce: Date.now() });
      setMobileMenu(false);
      setOverlay(null);
    },
    [],
  );
  const openSearch = useCallback(() => {
    setQuery("");
    setOverlay("search");
  }, []);
  useEffect(() => {
    if (!currentUser) { setOverlay(null); setImporting(false); setMobileMenu(false); }
    if (currentView === "access" && membershipRole !== "owner") setCurrentView("planning");
    if (currentUser?.role === "employee" && !["dashboard", "planning"].includes(currentView)) setCurrentView("planning");
  }, [currentUser?.id, currentUser?.role, currentView, membershipRole]);
  useEffect(() => {
    setOverlay(null); setImporting(false); setMobileMenu(false); setIntent({ nonce: Date.now() });
    setCreatingRestaurant(false); setToast(null);
  }, [restaurantId, account?.id]);
  useEffect(installMotionPolicy, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      document.documentElement.dataset.input = "keyboard";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") setMobileMenu(false);
    };
    const onPointer = () => {
      document.documentElement.dataset.input = "pointer";
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openSearch]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu) return;
    const workspace = workspaceRef.current;
    const sidebar = document.querySelector<HTMLElement>(".app-sidebar");
    const previous = document.activeElement as HTMLElement | null;
    if (workspace) workspace.inert = true;
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    // Wait for the drawer's visibility transition to enter its visible state.
    const focusFrame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || document.querySelector("dialog[open]")) return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!sidebar?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth > 800) setMobileMenu(false);
    };
    document.addEventListener("keydown", trap);
    window.addEventListener("resize", resize);
    return () => {
      if (workspace) workspace.inert = false;
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", trap);
      window.removeEventListener("resize", resize);
      previous?.focus();
    };
  }, [mobileMenu]);
  useEffect(() => {
    document.documentElement.dataset.motion = preferences.reduceMotion
      ? "reduced"
      : "full";
  }, [preferences.reduceMotion]);
  useEffect(() => {
    document.title = `${navigation.find((n) => n.id === currentView)?.label || "Connexion"} · Skellow`;
  }, [currentView]);
  const logout = async () => {
    try {
      await workspace.signOut();
      setOverlay(null);
      setImporting(false);
      setCurrentView("planning");
      setMobileMenu(false);
    } catch (cause) { notify(errorMessage(cause), "error"); }
  };
  const setPreference = (key: "compact" | "reduceMotion", value: boolean) => {
    const updated = { ...preferences, [key]: value };
    localStorage.setItem("skellow_preferences", JSON.stringify(updated));
    setPreferences(updated);
  };
  if (backendConfig.mode === "error" || workspace.loading || (!currentUser && workspace.error))
    return <main className="connection-page">
      <section className="login-card">
        <h1>{backendConfig.mode === "error" ? "Connexion à configurer" : workspace.loading ? "Ouverture de votre espace…" : "Votre espace est indisponible"}</h1>
        <p role={workspace.loading ? "status" : "alert"}>{backendConfig.mode === "error" ? backendConfig.message : workspace.loading ? "Nous vérifions votre connexion et chargeons vos données." : workspace.error}</p>
        {backendConfig.mode !== "error" && !workspace.loading && <div className="dialog-footer">
          <Button onClick={logout}>Changer de compte</Button>
          {workspace.mode === "supabase" && <Button onClick={() => void workspace.selectRestaurant(null)}>Ouvrir un établissement disponible</Button>}
          <Button variant="primary" disabled={workspace.refreshing} onClick={() => void workspace.reload()}>Réessayer</Button>
        </div>}
        {toast && toast.message !== workspace.error && <p role="alert" className="form-error">{toast.message}</p>}
      </section>
    </main>;
  if (workspace.recoveryRequested || (!account && !currentUser)) return <Login
    mode={workspace.mode} onLogin={workspace.signIn} invited={!!workspace.invitation}
    recovery={workspace.recovery && !!account} recoveryRequested={workspace.recoveryRequested}
    onCancelRecovery={workspace.cancelRecovery} onRecover={workspace.finishRecovery}
    onRegister={async (name, email, password) => !!await workspace.accountAction(() => accountRepository!.signUp(name, email, password), email)}
  />;
  if (account && (!restaurantId || workspace.invitation || creatingRestaurant)) return <RestaurantWelcome
    account={account} invited={!!workspace.invitation} onAccept={workspace.acceptInvitation}
    onDismiss={workspace.dismissInvitation} onLogout={logout}
    onBack={restaurantId && !workspace.invitation ? () => setCreatingRestaurant(false) : undefined}
    onCreate={async (id, name) => { await workspace.accountAction(() => accountRepository!.createRestaurant(id, name)); setCreatingRestaurant(false); }}
  />;
  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";
  const todayShifts = shifts.filter(
    (s) =>
      s.date === format(new Date(), "yyyy-MM-dd") &&
      (isAdmin || s.employeeId === currentUser.id),
  );
  const routes = navigation.filter(
    (n) =>
      (n.id === "access" ? membershipRole === "owner" : isAdmin || ["dashboard", "planning"].includes(n.id)) &&
      n.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")),
  );
  const people = isAdmin
    ? employees.filter((e) =>
        `${personName(e)} ${e.department}`
          .toLocaleLowerCase("fr")
          .includes(query.toLocaleLowerCase("fr")),
      )
    : [];
  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileMenu ? "mobile-menu-open" : ""} ${preferences.compact ? "density-compact" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <Sidebar
        mode={workspace.mode}
        restaurant={restaurant} restaurants={restaurants} owner={membershipRole === "owner"}
        onSelectRestaurant={id => void workspace.selectRestaurant(id)}
        onCreateRestaurant={() => { setCreatingRestaurant(true); setMobileMenu(false); }}
        disabled={workspace.saving}
        currentView={currentView}
        onNavigate={(view, department) => navigate(view, { department })}
        currentUser={currentUser}
        employees={employees}
        onLogout={logout}
        onSearch={openSearch}
        onSettings={() => setOverlay("settings")}
        onHelp={() => setOverlay("help")}
        collapsed={collapsed}
        mobileOpen={mobileMenu}
        onClose={() => {
          setMobileMenu(false);
          setCollapsed(true);
        }}
      />
      <div className="app-workspace" ref={workspaceRef}>
        <Topbar
          connectionLabel={workspace.saving ? "Enregistrement…" : workspace.error ? "Connexion à vérifier" : workspace.refreshing ? "Actualisation…" : workspace.mode === "supabase" ? "Espace partagé" : "Démo locale"}
          onRefresh={() => void workspace.reload()}
          refreshing={workspace.refreshing || workspace.saving}
          connected={workspace.mode === "supabase"}
          menuExpanded={isMobile ? mobileMenu : !collapsed}
          viewLabel={
            navigation.find((n) => n.id === currentView)?.label || "Planning"
          }
          currentUser={currentUser}
          onMenu={() => {
            if (window.matchMedia("(max-width: 800px)").matches) {
              setCollapsed(false);
              setMobileMenu((v) => !v);
            } else setCollapsed((v) => !v);
          }}
          onSearch={openSearch}
          onNotifications={() => setOverlay("notifications")}
          onProfile={() => setOverlay("settings")}
          notificationCount={todayShifts.length}
        />
        {workspace.error && <div className="connection-banner" role="alert">
          <span>{workspace.error}</span>
          <Button disabled={workspace.refreshing || workspace.saving} onClick={() => void workspace.reload()}>Actualiser</Button>
        </div>}
        <main
          className="app-main"
          id="main-content"
          tabIndex={-1}
          key={`${restaurantId || "demo"}:${currentView}`}
        >
          {currentView === "access" && membershipRole === "owner" && account && restaurant && <AccessManagement
            restaurant={restaurant} accountId={account.id} employees={employees}
            onChange={workspace.accountAction} notify={notify} onAddEmployee={() => navigate("employees", { action: "create" })}
          />}
          {currentView === "dashboard" && (
            <Dashboard
              employees={employees}
              shifts={shifts}
              currentUser={currentUser}
              onNavigate={navigate}
            />
          )}
          {currentView === "planning" && (
            <Planning
              employees={employees}
              shifts={shifts}
              currentUser={currentUser}
              onSaveShifts={(values: Shift[]) => workspace.mutate({ shifts: values.map(value => ({ kind: "save", value })) })}
              onDeleteShift={(value: Shift) => workspace.mutate({ shifts: [{ kind: "delete", value }] })}
              notify={notify}
              intent={intent}
            />
          )}
          {currentView === "employees" && isAdmin && (
            <EmployeeManagement
              employees={employees}
              shifts={shifts}
              currentUser={currentUser}
              mode={workspace.mode}
              onSaveEmployee={(value: Employee, password?: string) => workspace.mutate({ employees: [{ kind: "save", value }] }, password)}
              onDeleteEmployee={(value: Employee) => workspace.mutate({ employees: [{ kind: "delete", value }] })}
              intent={intent}
              notify={notify}
            />
          )}
          {currentView === "payslips" && isAdmin && (
            <PaySlipGenerator
              employees={employees}
              shifts={shifts}
              notify={notify}
            />
          )}
        </main>
      </div>
      {importing && isAdmin && workspace.snapshot && <LocalImport snapshot={workspace.snapshot} onImport={workspace.mutate} onClose={() => setImporting(false)} notify={notify} />}
      {overlay === "search" && (
        <Modal
          title="Aller à…"
          onClose={() => setOverlay(null)}
          className="command-dialog"
        >
          <div className="command-search">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Rechercher une page ou un membre"
              placeholder="Une page, un membre, un département…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>esc</kbd>
          </div>
          <div className="command-results">
            {routes.length > 0 && <p className="section-label">Navigation</p>}
            {routes.map((item) => (
              <button
                key={item.id}
                className="command-item"
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                <ArrowRight size={15} />
              </button>
            ))}
            {isAdmin && !query && (
              <button
                className="command-item"
                onClick={() => navigate("planning", { action: "create" })}
              >
                <Plus size={18} />
                <span>Ajouter un service</span>
                <ArrowRight size={15} />
              </button>
            )}
            {people.length > 0 && (
              <p className="section-label">Membres de l’équipe</p>
            )}
            {people.map((person) => (
              <button
                className="command-item"
                key={person.id}
                onClick={() => navigate("employees", { employeeId: person.id })}
              >
                <Avatar employee={person} size="xs" />
                <span>
                  {personName(person)}
                  <small>{person.position}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
            {!routes.length && !people.length && (
              <EmptyState
                title="Aucun résultat"
                description="Essayez le nom d’un membre ou d’une page."
              />
            )}
          </div>
          <div className="command-footer">
            <Command size={13} />
            <span>K pour ouvrir · Tab pour naviguer · Entrée pour choisir</span>
          </div>
        </Modal>
      )}
      {overlay === "settings" && (
        <Modal
          title="Vos préférences"
          description="Un espace à votre rythme."
          onClose={() => setOverlay(null)}
        >
          <div className="profile-summary">
            <Avatar employee={currentUser} size="lg" />
            <div>
              <h3>{personName(currentUser)}</h3>
              <p>{currentUser.email}</p>
              <Badge tone="sage">
                {membershipRole === "owner" ? "Propriétaire" : isAdmin ? "Administrateur" : "Membre de l’équipe"}
              </Badge>
            </div>
          </div>
          <div className="settings-row">
            <Monitor size={19} />
            <div>
              <strong>Affichage compact</strong>
              <p>Réduire l’espacement des listes et du planning.</p>
            </div>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label="Affichage compact"
              checked={!!preferences.compact}
              onChange={(e) => setPreference("compact", e.target.checked)}
            />
          </div>
          <div className="settings-row">
            <Settings2 size={19} />
            <div>
              <strong>Réduire les animations</strong>
              <p>Conserver des transitions discrètes.</p>
            </div>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label="Réduire les animations"
              checked={!!preferences.reduceMotion}
              onChange={(e) => setPreference("reduceMotion", e.target.checked)}
            />
          </div>
          <div className="info-note">
            <ShieldCheck size={17} />
            <p>
              {workspace.mode === "supabase"
                ? "Vos données sont partagées avec les personnes autorisées. Elles s’actualisent toutes les 30 secondes et à votre retour dans l’espace."
                : "Mode démonstration : les données et les accès restent sur cet appareil. Utilisez l’espace partagé pour gérer une véritable équipe."}
            </p>
          </div>
          {isAdmin && workspace.mode === "supabase" && <Button onClick={() => { setOverlay(null); setImporting(true); }}>Reprendre les données de cet appareil</Button>}
          <div className="dialog-footer">
            <Button disabled={workspace.saving} onClick={logout}>Se déconnecter</Button>
            <Button variant="primary" onClick={() => setOverlay(null)}>
              <Check size={15} />
              Terminé
            </Button>
          </div>
        </Modal>
      )}
      {overlay === "help" && (
        <Modal
          title="Prenez vos repères"
          description="Tout ce qu’il faut pour organiser votre équipe."
          onClose={() => setOverlay(null)}
        >
          <div className="help-item">
            <CalendarDays />
            <div>
              <h3>Un planning, deux points de vue</h3>
              <p>
                Organisez la semaine par membre, puis passez en agenda pour
                visualiser la durée des services.
              </p>
            </div>
          </div>
          <div className="help-item">
            <User />
            <div>
              <h3>Des fiches toujours à portée de main</h3>
              <p>
                Recherchez un membre ou filtrez par département. Ouvrez sa fiche
                pour mettre à jour ses informations.
              </p>
            </div>
          </div>
          <div className="help-item">
            <HelpCircle />
            <div>
              <h3>Des commandes directes</h3>
              <p>
                Cliquez sur un service pour le modifier ou sur une case vide
                pour en ajouter un. Vous pouvez aussi déplacer un service par
                glisser-déposer.
              </p>
            </div>
          </div>
          <div className="shortcut-row">
            <span>Recherche globale</span>
            <kbd>⌘ / Ctrl + K</kbd>
          </div>
          <div className="shortcut-row">
            <span>Fermer une fenêtre</span>
            <kbd>Échap</kbd>
          </div>
          <div className="shortcut-row">
            <span>Passer à la commande suivante</span>
            <kbd>Tab</kbd>
          </div>
        </Modal>
      )}
      {overlay === "notifications" && (
        <Modal
          title="Votre activité"
          description="Les services prévus aujourd’hui."
          onClose={() => setOverlay(null)}
        >
          {todayShifts.length ? (
            todayShifts.map((shift) => {
              const employee = employees.find((e) => e.id === shift.employeeId);
              return (
                employee && (
                  <div key={shift.id} className="activity-row">
                    <Avatar employee={employee} size="sm" />
                    <div>
                      <strong>{personName(employee)}</strong>
                      <p>
                        {shift.role} · {shift.startTime} – {shift.endTime}
                      </p>
                    </div>
                    <Badge
                      tone={
                        shift.status?.startsWith("absence") ? "rose" : "sage"
                      }
                    >
                      {shift.status?.startsWith("absence")
                        ? "Absent"
                        : shift.status === "present"
                          ? "Présent"
                          : "Prévu"}
                    </Badge>
                  </div>
                )
              );
            })
          ) : (
            <EmptyState
              icon={<CalendarDays />}
              title="Une journée sans service"
              description="Consultez le planning pour préparer la suite."
            />
          )}
          <div className="dialog-footer">
            <Button variant="primary" onClick={() => navigate("planning")}>
              Ouvrir le planning
              <ArrowRight size={15} />
            </Button>
          </div>
        </Modal>
      )}
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={closeToast} />
      )}
    </div>
  );
}
export default App;
