import { FormEvent, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Mail,
  Moon,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { CurrentUser, Employee, Shift } from "../types";
import type { ViewIntent } from "../App";
import { generateId } from "../data";
import { useAsyncAction } from "../backend/useAsyncAction";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
  SelectionGroup,
  csvCell,
  downloadText,
  money,
  number,
  personName,
  toneFor,
} from "./ui";
import { useCollectionMotion } from "../motion";
import { DayTimeline } from "./Planning";
interface Props {
  employees: Employee[];
  shifts: Shift[];
  currentUser: CurrentUser;
  mode: "demo" | "supabase";
  onSaveEmployee: (employee: Employee, demoPassword?: string) => Promise<void>;
  onDeleteEmployee: (employee: Employee) => Promise<void>;
  intent: ViewIntent;
  notify: (message: string) => void;
}
export default function EmployeeManagement({
  employees,
  shifts,
  currentUser,
  mode,
  onSaveEmployee,
  onDeleteEmployee,
  intent,
  notify,
}: Props) {
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(intent.department || "all");
  const [status, setStatus] = useState<"active" | "all" | "inactive">("active");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [timelineDate, setTimelineDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  useEffect(() => {
    setDepartment(intent.department || "all");
    if (intent.action === "create") setEditing("new");
    if (intent.employeeId)
      setEditing(employees.find((e) => e.id === intent.employeeId) || null);
  }, [intent]);
  const active = employees.filter((e) => e.active);
  const departments = [...new Set(employees.map((e) => e.department))];
  const filtered = employees.filter(
    (e) =>
      (status === "all" || e.active === (status === "active")) &&
      (department === "all" || e.department === department) &&
      `${personName(e)} ${e.email} ${e.position}`
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
  );
  const collectionRef = useCollectionMotion(
    `${layout}:${filtered.map((person) => person.id).join(",")}`,
  );
  const exportEmployees = () => {
    const data = [
      [
        "Prénom",
        "Nom",
        "E-mail",
        "Téléphone",
        "Poste",
        "Département",
        "Contrat",
        "Début",
        "Heures mensuelles",
        "Actif",
      ],
      ...filtered.map((e) => [
        e.firstName,
        e.lastName,
        e.email,
        e.phone,
        e.position,
        e.department,
        e.contractType,
        e.startDate,
        e.monthlyHours,
        e.active ? "Oui" : "Non",
      ]),
    ];
    downloadText(
      "equipe-skellow.csv",
      data.map((row) => row.map(csvCell).join(";")).join("\r\n"),
    );
    notify("La liste des membres a été exportée.");
  };
  const save = async (employee: Employee, demoPassword?: string) => {
    await onSaveEmployee(employee, demoPassword);
    setEditing(null);
    notify("La fiche du membre a été enregistrée.");
  };
  return (
    <div className="page team-page">
      <PageHeader
        title="Une belle équipe."
        description={
          <>
            {active.length} membres actifs,{" "}
            {new Set(active.map((e) => e.department)).size} départements. Et une
            même énergie.
          </>
        }
      >
        <Button onClick={exportEmployees} disabled={!filtered.length}>
          <ArrowDownToLine size={16} />
          Exporter
        </Button>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <UserPlus size={16} />
          Ajouter un membre
        </Button>
      </PageHeader>
      <div className="page-tabs">
        <SelectionGroup
          className="tab-buttons"
          value={status}
          label="Statut des membres"
        >
          <button
            onClick={() => setStatus("active")}
            className={status === "active" ? "active" : ""}
            aria-pressed={status === "active"}
          >
            <Users size={16} />
            Membres actifs<Badge>{active.length}</Badge>
          </button>
          <button
            onClick={() => setStatus("all")}
            className={status === "all" ? "active" : ""}
            aria-pressed={status === "all"}
          >
            Tous les membres
          </button>
          <button
            onClick={() => setStatus("inactive")}
            className={status === "inactive" ? "active" : ""}
            aria-pressed={status === "inactive"}
          >
            Archivés<Badge>{employees.length - active.length}</Badge>
          </button>
        </SelectionGroup>
      </div>
      <div className="section-toolbar">
        <div className="section-title">
          <h2>
            {department === "all" ? "Les visages de vos soirées" : department}
          </h2>
          <span className="count-label">{filtered.length}</span>
        </div>
        <div className="filter-controls">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Rechercher dans l’équipe"
            placeholder="Rechercher un membre…"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filtrer l’équipe par département"
          >
            <option value="all">Tous les départements</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <Segmented
            value={layout}
            onChange={setLayout}
            label="Présentation des membres"
            options={[
              { value: "grid", label: "Grille", icon: <Grid2X2 size={16} /> },
              { value: "list", label: "Liste", icon: <List size={17} /> },
            ]}
          />
        </div>
      </div>
      <div ref={collectionRef} className="member-collection">
        {!filtered.length ? (
          <div className="panel">
            <EmptyState
              icon={<Users />}
              title={
                status === "inactive"
                  ? "Aucun membre archivé"
                  : "Aucun membre trouvé"
              }
              description={
                status === "inactive"
                  ? "Les membres désactivés restent accessibles ici."
                  : "Essayez un autre nom ou un autre département."
              }
              action={
                (query || department !== "all") && (
                  <Button
                    onClick={() => {
                      setQuery("");
                      setDepartment("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                )
              }
            />
          </div>
        ) : layout === "grid" ? (
          <div className="member-grid">
            {filtered.map((employee) => (
              <article
                key={employee.id}
                data-motion-key={employee.id}
                className={`member-card ${!employee.active ? "member-inactive" : ""}`}
              >
                <div className="member-card-top">
                  <Avatar employee={employee} size="lg" />
                  <Badge tone={employee.active ? "sage" : "neutral"} dot>
                    {employee.active ? "Actif" : "Archivé"}
                  </Badge>
                </div>
                <button
                  className="member-name"
                  onClick={() => setEditing(employee)}
                >
                  {personName(employee)}
                  <ArrowRight size={17} />
                </button>
                <p className="member-role">{employee.position}</p>
                <div className="member-facts">
                  <div>
                    <span className="sr-only">Département</span>
                    <Badge tone={toneFor(employee.department)} dot>
                      {employee.department.split("/")[0]}
                    </Badge>
                  </div>
                  <div>
                    <span className="sr-only">Contrat</span>
                    <strong>
                      {employee.contractType}
                      <span className="separator-dot">·</span>
                      {number(employee.monthlyHours)} h
                    </strong>
                  </div>
                </div>
                <div className="member-contact">
                  <a href={`mailto:${employee.email}`}>
                    <Mail size={13} />
                    {employee.email}
                  </a>
                  <span>
                    Depuis{" "}
                    {format(
                      new Date(`${employee.startDate}T12:00:00`),
                      "MMM yyyy",
                      { locale: fr },
                    )}
                  </span>
                </div>
                <button
                  className="member-open"
                  onClick={() => setEditing(employee)}
                  aria-label={`Ouvrir la fiche de ${personName(employee)}`}
                >
                  <ArrowRight size={16} />
                </button>
              </article>
            ))}
            <button
              className="invite-card"
              data-motion-key="invite"
              onClick={() => setEditing("new")}
            >
              <span>
                <Plus size={24} />
              </span>
              <strong>Une place dans l’équipe</strong>
              <p>Les belles soirées se préparent ensemble.</p>
              <span className="invite-link">
                Ajouter un membre
                <ArrowRight size={14} />
              </span>
            </button>
          </div>
        ) : (
          <div className="table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Département</th>
                  <th>Contrat</th>
                  <th>Taux horaire</th>
                  <th>Statut</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} data-motion-key={employee.id}>
                    <td>
                      <button
                        className="table-person"
                        onClick={() => setEditing(employee)}
                      >
                        <Avatar employee={employee} size="sm" />
                        <span>
                          <strong>{personName(employee)}</strong>
                          <small>{employee.position}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Badge tone={toneFor(employee.department)} dot>
                        {employee.department}
                      </Badge>
                    </td>
                    <td>
                      {employee.contractType}
                      <span className="table-secondary">
                        {number(employee.monthlyHours)} h / mois
                      </span>
                    </td>
                    <td className="numeric">{money(employee.hourlyRate)}</td>
                    <td>
                      <Badge tone={employee.active ? "sage" : "neutral"}>
                        {employee.active ? "Actif" : "Archivé"}
                      </Badge>
                    </td>
                    <td>
                      <IconButton
                        label={`Modifier ${personName(employee)}`}
                        onClick={() => setEditing(employee)}
                      >
                        <ArrowRight size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="team-timeline-heading">
        <h2>L’équipe en scène</h2>
        <div className="date-navigation">
          <IconButton
            label="Journée précédente"
            onClick={() =>
              setTimelineDate(
                format(
                  addDays(new Date(`${timelineDate}T12:00:00`), -1),
                  "yyyy-MM-dd",
                ),
              )
            }
          >
            <ChevronLeft size={16} />
          </IconButton>
          <input
            type="date"
            aria-label="Journée de l’équipe"
            value={timelineDate}
            onChange={(e) => {
              if (e.target.value) setTimelineDate(e.target.value);
            }}
          />
          <IconButton
            label="Journée suivante"
            onClick={() =>
              setTimelineDate(
                format(
                  addDays(new Date(`${timelineDate}T12:00:00`), 1),
                  "yyyy-MM-dd",
                ),
              )
            }
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
      <DayTimeline date={timelineDate} employees={filtered} shifts={shifts} />
      {editing && (
        <EmployeeEditor
          employee={editing === "new" ? null : editing}
          employees={employees}
          shifts={shifts}
          currentUser={currentUser}
          mode={mode}
          onSave={save}
          onClose={() => setEditing(null)}
          onDelete={async (employee) => {
            await onDeleteEmployee(employee);
            setEditing(null);
            notify("Le membre a été supprimé.");
          }}
        />
      )}
    </div>
  );
}
function EmployeeEditor({
  employee,
  employees,
  shifts,
  currentUser,
  mode,
  onSave,
  onClose,
  onDelete,
}: {
  employee: Employee | null;
  employees: Employee[];
  shifts: Shift[];
  currentUser: CurrentUser;
  mode: "demo" | "supabase";
  onSave: (employee: Employee, demoPassword?: string) => Promise<void>;
  onClose: () => void;
  onDelete: (employee: Employee) => Promise<void>;
}) {
  const [form, setForm] = useState<Employee>(
    employee || {
      id: generateId(),
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      department: "Bar",
      contractType: "CDI",
      startDate: format(new Date(), "yyyy-MM-dd"),
      hourlyRate: 11.65,
      monthlyHours: 151.67,
      socialSecurityNumber: "",
      address: "",
      postalCode: "",
      city: "",
      bankRIB: "",
      role: "employee",
      active: true,
      nightWork: true,
    },
  );
  const { pending, error, setError, run } = useAsyncAction();
  const [demoPassword, setDemoPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const self = employee?.id === currentUser.id;
  const set = (field: keyof Employee, value: string | number | boolean) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      employees.some(
        (e) =>
          e.id !== form.id &&
          e.email.toLowerCase() === form.email.trim().toLowerCase(),
      )
    ) {
      setError("Cette adresse e-mail est déjà utilisée par un autre membre.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError("La fin du contrat doit suivre sa date de début.");
      return;
    }
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.position.trim()
    ) {
      setError("Renseignez le prénom, le nom et le poste.");
      return;
    }
    void run(() => onSave({
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      position: form.position.trim(),
    }, mode === "demo" ? demoPassword : undefined));
  };
  return (
    <Modal
      title={employee ? "La fiche de votre membre" : "Bienvenue dans l’équipe"}
      description={
        employee
          ? "Coordonnées, contrat et informations de travail."
          : "Ajoutez les informations essentielles. Vous pourrez les compléter plus tard."
      }
      onClose={() => { if (!pending) onClose(); }}
      wide
    >
      <form onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending}>
        <div className="form-fields">
          {employee && (
            <div className="editor-profile">
              <Avatar employee={form} size="lg" />
              <div>
                <h3>{personName(form)}</h3>
                <p>{form.position}</p>
              </div>
              <Badge tone={form.active ? "sage" : "neutral"} dot>
                {form.active ? "Actif" : "Archivé"}
              </Badge>
            </div>
          )}
          <div className="form-section-title">Informations personnelles</div>
          <div className="form-grid">
            <label className="field">
              Prénom
              <input
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
            </label>
            <label className="field">
              Nom
              <input
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </label>
            <label className="field">
              Adresse e-mail
              <input
                type="email"
                autoComplete="email"
                disabled={mode === "supabase" && !!employee?.accessLinked}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </label>
            <label className="field">
              Téléphone
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
          </div>
          <div className="form-section-title">Au sein de l’équipe</div>
          <div className="form-grid">
            <label className="field">
              Poste
              <input
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
                placeholder="Ex. Barman"
                required
              />
            </label>
            <label className="field">
              Département
              <select
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              >
                {[
                  ...new Set([
                    "Bar",
                    "Sécurité",
                    "Accueil/Caisse",
                    "Vestiaire",
                    "DJ/Animation",
                    "Direction",
                    "Ménage/Entretien",
                    ...employees.map((e) => e.department),
                  ]),
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Type de contrat
              <select
                value={form.contractType}
                onChange={(e) => set("contractType", e.target.value)}
              >
                {["CDI", "CDD", "Alternance", "Stage"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Date d’arrivée
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                required
              />
            </label>
            {form.contractType !== "CDI" && (
              <label className="field">
                Fin du contrat
                <input
                  type="date"
                  value={form.endDate || ""}
                  min={form.startDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </label>
            )}
            <label className="field">
              Taux horaire brut (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={(e) => set("hourlyRate", Number(e.target.value))}
                required
              />
            </label>
            <label className="field">
              Heures mensuelles
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyHours}
                onChange={(e) => set("monthlyHours", Number(e.target.value))}
                required
              />
            </label>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={!!form.nightWork}
              onChange={(e) => set("nightWork", e.target.checked)}
            />
            <Moon size={16} />
            Travail de nuit régulier
          </label>
          <details className="form-details">
            <summary>Coordonnées administratives</summary>
            <div className="form-fields">
              <label className="field">
                Adresse
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  Code postal
                  <input
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                  />
                </label>
                <label className="field">
                  Ville
                  <input
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                Numéro de sécurité sociale
                <input
                  value={form.socialSecurityNumber}
                  onChange={(e) => set("socialSecurityNumber", e.target.value)}
                />
              </label>
              <label className="field">
                RIB / IBAN
                <input
                  value={form.bankRIB}
                  onChange={(e) => set("bankRIB", e.target.value)}
                />
              </label>
            </div>
          </details>
          <details className="form-details" open={!employee}>
            <summary>Accès à l’espace de travail</summary>
            <div className="form-grid">
              {mode === "demo" ? <label className="field">
                {employee ? "Nouveau mot de passe (facultatif)" : "Mot de passe"}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={demoPassword}
                  onChange={(e) => setDemoPassword(e.target.value)}
                  required={!employee}
                />
              </label> : <p className="info-note">{employee?.accessLinked
                ? "Compte de connexion lié à cette fiche."
                : "Pour activer son compte, le propriétaire crée un lien d’invitation dans Accès."}</p>}
              {mode === "demo" && <label className="field">
                Rôle
                <select
                  value={form.role}
                  disabled={self}
                  onChange={(e) => set("role", e.target.value)}
                >
                  <option value="employee">Employé</option>
                  <option value="admin">Administrateur</option>
                </select>
              </label>}
            </div>
          </details>
          {employee && !self && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              Membre actif — désactivez pour archiver sa fiche.
            </label>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {deleting && (
          <div className="delete-confirm">
            {shifts.some((s) => s.employeeId === form.id) ? (
              <p>
                Ce membre a des services enregistrés. Archivez sa fiche pour
                conserver l’historique du planning.
              </p>
            ) : (
              <>
                <p>Supprimer définitivement la fiche de {personName(form)} ?</p>
                <Button variant="danger" onClick={() => void run(() => onDelete(form))}>
                  Confirmer la suppression
                </Button>
              </>
            )}
            <Button onClick={() => setDeleting(false)}>
              Conserver la fiche
            </Button>
          </div>
        )}
        <div className="dialog-footer">
          {employee && !self && (
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              Supprimer
            </Button>
          )}
          <span className="flex-spacer" />
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary">
            <Check size={16} />
            {pending ? "Enregistrement…" : employee ? "Enregistrer" : "Ajouter le membre"}
          </Button>
        </div>
        </fieldset>
      </form>
    </Modal>
  );
}
