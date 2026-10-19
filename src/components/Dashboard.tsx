import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Moon,
  Plus,
  Sun,
  UserPlus,
  Users,
} from "lucide-react";
import { CurrentUser, Employee, Shift, ViewType } from "../types";
import type { ViewIntent } from "../App";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  TextLink,
  isAbsent,
  number,
  personName,
  toneFor,
  workedHours,
} from "./ui";
interface Props {
  employees: Employee[];
  shifts: Shift[];
  currentUser: CurrentUser;
  onNavigate: (view: ViewType, intent?: Omit<ViewIntent, "nonce">) => void;
}
export default function Dashboard({
  employees,
  shifts,
  currentUser,
  onNavigate,
}: Props) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const isAdmin = currentUser.role === "admin";
  const week = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const dates = days.map((d) => format(d, "yyyy-MM-dd"));
  const scoped = shifts.filter(
    (s) => isAdmin || s.employeeId === currentUser.id,
  );
  const weekly = scoped.filter((s) => dates.includes(s.date));
  const tonight = scoped
    .filter((s) => s.date === todayStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = scoped
    .filter(
      (s) =>
        new Date(`${s.date}T${s.startTime}`).getTime() >= today.getTime() &&
        !isAbsent(s),
    )
    .sort((a, b) =>
      `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
    )
    .slice(0, 4);
  const active = employees.filter((e) => e.active);
  const departments = [...new Set(active.map((e) => e.department))];
  const maxHours = Math.max(
    1,
    ...dates.map((d) => workedHours(weekly.filter((s) => s.date === d))),
  );
  return (
    <div className="page dashboard-page">
      <PageHeader
        title={`Bonjour, ${currentUser.firstName}.`}
        description="Un peu de clarté avant que la soirée ne commence."
      >
        <Button onClick={() => onNavigate("planning")}>
          <CalendarDays size={16} />
          Voir le planning
        </Button>
        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => onNavigate("planning", { action: "create" })}
          >
            <Plus size={17} />
            Ajouter un service
          </Button>
        )}
      </PageHeader>
      <div className="dashboard-date">
        <Sun size={16} />
        <span>{format(today, "EEEE d MMMM yyyy", { locale: fr })}</span>
        <Badge tone="sage" dot>
          Votre espace est à jour
        </Badge>
      </div>
      <div className="overview-stats">
        <div>
          <span>
            <Clock3 size={16} />
            Heures planifiées
          </span>
          <strong>
            {number(workedHours(weekly))}
            <small> h</small>
          </strong>
          <p>Cette semaine</p>
        </div>
        <div>
          <span>
            <CalendarDays size={16} />
            Services prévus
          </span>
          <strong>{weekly.length.toString().padStart(2, "0")}</strong>
          <p>
            Du {format(week, "d")} au{" "}
            {format(days[6], "d MMMM", { locale: fr })}
          </p>
        </div>
        <div>
          <span>
            <Users size={16} />
            {isAdmin ? "Membres actifs" : "Mes services ce soir"}
          </span>
          <strong>
            {(isAdmin ? active.length : tonight.length)
              .toString()
              .padStart(2, "0")}
          </strong>
          <p>
            {isAdmin
              ? `${departments.length} départements`
              : "Bonne soirée à vous"}
          </p>
        </div>
        <div>
          <span>
            <Moon size={16} />
            Absences signalées
          </span>
          <strong>
            {weekly.filter(isAbsent).length.toString().padStart(2, "0")}
          </strong>
          <p>Cette semaine</p>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="panel tonight-panel">
          <div className="section-heading">
            <div>
              <h2>Ce soir, à vos côtés</h2>
              <p>
                {tonight.length} service{tonight.length > 1 ? "s" : ""} au
                programme
              </p>
            </div>
            <Badge>
              <Moon size={13} />
              Ce soir
            </Badge>
          </div>
          <div className="tonight-list">
            {tonight.length ? (
              tonight.map((shift) => {
                const person = employees.find((e) => e.id === shift.employeeId);
                return (
                  person && (
                    <div className="roster-row" key={shift.id}>
                      <Avatar employee={person} />
                      <div>
                        <strong>{personName(person)}</strong>
                        <span>{shift.role}</span>
                      </div>
                      <div>
                        <strong className="numeric">
                          {shift.startTime} — {shift.endTime}
                        </strong>
                        <Badge tone={isAbsent(shift) ? "rose" : "sage"} dot>
                          {isAbsent(shift)
                            ? "Absent"
                            : shift.status === "present"
                              ? "Présent"
                              : "Prévu"}
                        </Badge>
                      </div>
                    </div>
                  )
                );
              })
            ) : (
              <EmptyState
                icon={<Moon />}
                title="Une soirée libre"
                description="Aucun service n’est prévu pour aujourd’hui."
              />
            )}
          </div>
          <div className="panel-footer">
            <TextLink onClick={() => onNavigate("planning")}>
              Ouvrir le planning complet
            </TextLink>
          </div>
        </section>
        <section className="panel week-rhythm">
          <div className="section-heading">
            <div>
              <h2>Le rythme de la semaine</h2>
              <p>Heures planifiées par jour</p>
            </div>
            <Clock3 size={18} className="muted" />
          </div>
          <div
            className="week-chart"
            role="img"
            aria-label={days
              .map(
                (d, i) =>
                  `${format(d, "EEEE", { locale: fr })} : ${number(workedHours(weekly.filter((s) => s.date === dates[i])))} heures`,
              )
              .join(", ")}
          >
            {days.map((day, index) => {
              const hours = workedHours(
                weekly.filter((s) => s.date === dates[index]),
              );
              return (
                <div
                  className={`chart-column ${dates[index] === todayStr ? "chart-today" : ""}`}
                  key={dates[index]}
                >
                  <span>{number(hours)} h</span>
                  <div className="chart-track">
                    <div
                      className="chart-bar"
                      style={{
                        height: `${Math.max(2, (hours / maxHours) * 100)}%`,
                      }}
                    />
                  </div>
                  <span>
                    {format(day, "EEE", { locale: fr }).replace(".", "")}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="chart-note">
            <span className="status-dot" />
            Aujourd’hui
            <span className="flex-spacer" />
            {number(workedHours(weekly))} h au total
          </div>
        </section>
      </div>
      <div className="section-toolbar">
        <div>
          <h2>Les prochains rendez-vous</h2>
          <p className="muted small">La suite se prépare ici.</p>
        </div>
        <TextLink onClick={() => onNavigate("planning")}>
          Tous les services
        </TextLink>
      </div>
      <div className="upcoming-list">
        {upcoming.length ? (
          upcoming.map((shift) => {
            const employee = employees.find((e) => e.id === shift.employeeId);
            return (
              employee && (
                <button
                  className="upcoming-item"
                  key={shift.id}
                  onClick={() =>
                    onNavigate("planning", {
                      date: shift.date,
                      shiftId: shift.id,
                    })
                  }
                >
                  <div className="date-tile">
                    <span>
                      {format(new Date(`${shift.date}T12:00:00`), "MMM", {
                        locale: fr,
                      })}
                    </span>
                    <strong>
                      {format(new Date(`${shift.date}T12:00:00`), "dd")}
                    </strong>
                  </div>
                  <div>
                    <strong>{personName(employee)}</strong>
                    <span>
                      {shift.startTime} — {shift.endTime}
                    </span>
                  </div>
                  <Badge tone={toneFor(employee.department)}>
                    {employee.department.split("/")[0]}
                  </Badge>
                  <ArrowRight size={16} />
                </button>
              )
            );
          })
        ) : (
          <EmptyState
            title="Tout est à organiser"
            description="Vos prochains services apparaîtront ici."
            action={
              isAdmin && (
                <Button
                  onClick={() => onNavigate("planning", { action: "create" })}
                >
                  <Plus size={15} />
                  Planifier un service
                </Button>
              )
            }
          />
        )}
      </div>
      {isAdmin && (
        <section className="dashboard-team">
          <div>
            <h2>Chaque personne fait la différence.</h2>
            <p>
              Retrouvez les coordonnées, les contrats et les informations de
              votre équipe.
            </p>
          </div>
          <div className="avatar-stack">
            {active.slice(0, 5).map((e) => (
              <Avatar key={e.id} employee={e} size="sm" />
            ))}
          </div>
          <Button onClick={() => onNavigate("employees")}>
            Rencontrer l’équipe
            <ArrowRight size={16} />
          </Button>
        </section>
      )}
    </div>
  );
}
