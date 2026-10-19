import {
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  addDays,
  addWeeks,
  format,
  isToday,
  startOfWeek,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  LayoutList,
  Moon,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { CurrentUser, Employee, Shift } from "../types";
import type { ViewIntent } from "../App";
import { useContentTransition, useTimelineReveal } from "../motion";
import { generateId } from "../data";
import { useAsyncAction } from "../backend/useAsyncAction";
import { errorMessage } from "../backend/contracts";
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
  isAbsent,
  minutes,
  number,
  overlaps,
  personName,
  shiftHours,
  toneFor,
  workedHours,
} from "./ui";
interface Props {
  employees: Employee[];
  shifts: Shift[];
  currentUser: CurrentUser;
  onSaveShifts: (shifts: Shift[]) => Promise<void>;
  onDeleteShift: (shift: Shift) => Promise<void>;
  notify: (message: string, tone?: "success" | "error") => void;
  intent: ViewIntent;
}
export default function Planning({
  employees,
  shifts,
  currentUser,
  onSaveShifts,
  onDeleteShift,
  notify,
  intent,
}: Props) {
  const isAdmin = currentUser.role === "admin";
  const [week, setWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [view, setView] = useState<"team" | "agenda">("team");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [selectedDay, setSelectedDay] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const scheduleRef = useContentTransition<HTMLDivElement>(
    format(week, "yyyy-MM-dd"),
  );
  const [editing, setEditing] = useState<Partial<Shift> | null>(null);
  const [copyWeek, setCopyWeek] = useState(false);
  const copying = useAsyncAction();
  const copyDraft = useRef<Shift[] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  useEffect(() => {
    if (intent.action === "create" && isAdmin) setEditing({});
    if (intent.date) {
      setWeek(
        startOfWeek(new Date(`${intent.date}T12:00:00`), { weekStartsOn: 1 }),
      );
      setSelectedDay(intent.date);
    }
    if (intent.shiftId) {
      const target = shifts.find(
        (s) =>
          s.id === intent.shiftId &&
          (isAdmin || s.employeeId === currentUser.id),
      );
      if (target) setEditing(target);
    }
  }, [intent, isAdmin]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const dates = days.map((day) => format(day, "yyyy-MM-dd"));
  const scopedEmployees = employees.filter(
    (e) => isAdmin || e.id === currentUser.id,
  );
  const visibleEmployees = scopedEmployees.filter(
    (e) =>
      (e.active ||
        shifts.some((s) => s.employeeId === e.id && dates.includes(s.date))) &&
      (department === "all" || e.department === department) &&
      `${personName(e)} ${e.position}`
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
  );
  const weekShifts = shifts.filter(
    (s) =>
      dates.includes(s.date) &&
      visibleEmployees.some((e) => e.id === s.employeeId),
  );
  const nightShifts = weekShifts.filter(
    (s) => minutes(s.endTime) < minutes(s.startTime),
  ).length;
  const activePeople = new Set(
    weekShifts.filter((s) => !isAbsent(s)).map((s) => s.employeeId),
  ).size;
  const navigateWeek = (next: Date) => {
    setWeek(next);
    setSelectedDay(
      format(
        addDays(next, Math.max(0, dates.indexOf(selectedDay))),
        "yyyy-MM-dd",
      ),
    );
  };
  const today = () => {
    setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSelectedDay(format(new Date(), "yyyy-MM-dd"));
  };
  const exportPlanning = () => {
    const data = [
      [
        "Date",
        "Employé",
        "Département",
        "Début",
        "Fin",
        "Heures",
        "Poste",
        "Statut",
      ],
      ...[...weekShifts]
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        )
        .map((s) => {
          const e = employees.find((e) => e.id === s.employeeId)!;
          return [
            s.date,
            personName(e),
            e.department,
            s.startTime,
            s.endTime,
            shiftHours(s),
            s.role,
            s.status || "scheduled",
          ];
        }),
    ];
    downloadText(
      `planning-${dates[0]}.csv`,
      data.map((row) => row.map(csvCell).join(";")).join("\r\n"),
    );
    notify("Le planning a été exporté.");
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedId(null);
    if (!event.over || !isAdmin) return;
    const shift = shifts.find((s) => s.id === event.active.id);
    const target = event.over.data.current;
    if (
      !shift ||
      !target ||
      (shift.date === target.date && shift.employeeId === target.employeeId)
    )
      return;
    const employee = employees.find((e) => e.id === target.employeeId);
    if (!employee?.active) {
      notify(
        "Ce membre est inactif. Réactivez sa fiche pour lui attribuer un service.",
        "error",
      );
      return;
    }
    const updated = {
      ...shift,
      date: target.date as string,
      employeeId: employee.id,
      role: employee.id === shift.employeeId ? shift.role : employee.position,
    };
    if (overlaps(updated, shifts)) {
      notify(
        "Déplacement impossible : ce membre a déjà un service à cet horaire.",
        "error",
      );
      return;
    }
    try {
      await onSaveShifts([updated]);
      notify("Service déplacé et enregistré.");
    } catch (cause) { notify(errorMessage(cause), "error"); }
  };
  const duplicateWeek = async () => {
    const copies: Shift[] = [];
    const next = [...shifts];
    let count = 0;
    weekShifts.forEach((s) => {
      const copy = {
        ...s,
        id: generateId(),
        revision: undefined,
        date: format(addDays(new Date(`${s.date}T12:00:00`), 7), "yyyy-MM-dd"),
        status: "scheduled" as const,
      };
      if (
        employees.find((e) => e.id === copy.employeeId)?.active &&
        !overlaps(copy, next) &&
        !next.some(
          (t) =>
            t.employeeId === copy.employeeId &&
            t.date === copy.date &&
            t.startTime === copy.startTime &&
            t.endTime === copy.endTime,
        )
      ) {
        next.push(copy);
        copies.push(copy);
        count++;
      }
    });
    copyDraft.current ??= copies;
    count = copyDraft.current.length;
    if (count) await onSaveShifts(copyDraft.current);
    copyDraft.current = null;
    setCopyWeek(false);
    notify(
      `${count} service${count > 1 ? "s" : ""} copié${count > 1 ? "s" : ""} sur la semaine suivante${count < weekShifts.length ? " ; doublons et conflits ignorés" : ""}.`,
    );
  };
  return (
    <div className="page planning-page">
      <PageHeader
        title={isAdmin ? "Le planning, en harmonie." : "Votre planning."}
        description={
          isAdmin
            ? "Les bonnes personnes, au bon moment. Organisez la semaine en un regard."
            : "Vos prochains services et votre semaine, au même endroit."
        }
      >
        <Button onClick={exportPlanning} disabled={!weekShifts.length}>
          <Download size={16} />
          Exporter
        </Button>
        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => setEditing({ date: selectedDay })}
            disabled={!employees.some((e) => e.active)}
          >
            <Plus size={17} />
            Ajouter un service
          </Button>
        )}
      </PageHeader>
      <div className="page-tabs">
        <SelectionGroup
          className="tab-buttons"
          value={view}
          label="Vue du planning"
        >
          <button
            className={view === "team" ? "active" : ""}
            aria-pressed={view === "team"}
            onClick={() => setView("team")}
          >
            <Users size={16} />
            Planning d’équipe
          </button>
          <button
            className={view === "agenda" ? "active" : ""}
            aria-pressed={view === "agenda"}
            onClick={() => setView("agenda")}
          >
            <CalendarDays size={16} />
            Agenda horaire
          </button>
        </SelectionGroup>
        <span className="small muted">
          Semaine {getISOWeek(week)}
          <span className="separator-dot">·</span>
          {weekShifts.length} service{weekShifts.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="planning-toolbar">
        <div className="date-navigation">
          <div className="date-arrows glass">
            <IconButton
              label="Semaine précédente"
              onClick={() => navigateWeek(addWeeks(week, -1))}
            >
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton
              label="Semaine suivante"
              onClick={() => navigateWeek(addWeeks(week, 1))}
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
          <h2>
            {format(week, "d", { locale: fr })}
            {format(week, "MM") !== format(days[6], "MM") &&
              ` ${format(week, "MMM", { locale: fr })}`}{" "}
            – {format(days[6], "d MMMM yyyy", { locale: fr })}
          </h2>
          <Button className="today-button" onClick={today}>
            Aujourd’hui
          </Button>
        </div>
        <div className="filter-controls">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Rechercher un membre…"
            label="Rechercher un membre dans le planning"
          />
          {isAdmin && (
            <select
              aria-label="Filtrer le planning par département"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="all">Tous les départements</option>
              {[...new Set(scopedEmployees.map((e) => e.department))].map(
                (d) => (
                  <option key={d}>{d}</option>
                ),
              )}
            </select>
          )}
        </div>
      </div>
      <div className="planning-summary">
        <span>
          <span className="summary-icon">
            <Users size={15} />
          </span>
          <strong>{activePeople}</strong>{" "}
          {activePeople > 1 ? "membres planifiés" : "membre planifié"}
        </span>
        <span>
          <Clock3 size={15} />
          <strong>{number(workedHours(weekShifts))} h</strong> sur la semaine
        </span>
        <span>
          <Moon size={15} />
          <strong>{nightShifts}</strong> service{nightShifts > 1 ? "s" : ""} de
          nuit
        </span>
        {isAdmin && (
          <button
            onClick={() => { copyDraft.current = null; copying.setError(""); setCopyWeek(true); }}
            disabled={!weekShifts.length}
          >
            <Copy size={14} />
            Dupliquer la semaine
          </button>
        )}
      </div>
      {view === "team" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={(event) => setDraggedId(String(event.active.id))}
          onDragCancel={() => setDraggedId(null)}
          onDragEnd={handleDragEnd}
        >
          <MobileDayPlanning
            days={days}
            selectedDay={selectedDay}
            onDay={setSelectedDay}
            employees={visibleEmployees}
            shifts={weekShifts}
            canEdit={isAdmin}
            onEdit={setEditing}
          />
          <div className="schedule-frame">
            <div
              ref={scheduleRef}
              className="schedule-scroll"
              tabIndex={0}
              role="region"
              aria-label="Planning hebdomadaire défilant"
            >
              <table className="schedule-table">
                <caption className="sr-only">
                  Planning de la semaine du{" "}
                  {format(week, "d MMMM yyyy", { locale: fr })}
                </caption>
                <thead>
                  <tr>
                    <th className="person-column">
                      <span>Membre de l’équipe</span>
                      <Badge>{visibleEmployees.length}</Badge>
                    </th>
                    {days.map((day) => (
                      <th
                        key={day.toISOString()}
                        className={isToday(day) ? "today-column" : ""}
                      >
                        <span className="day-name">
                          {format(day, "EEE", { locale: fr }).replace(".", "")}
                        </span>
                        <span
                          className={`day-number ${isToday(day) ? "today-number" : ""}`}
                        >
                          {format(day, "dd")}
                        </span>
                      </th>
                    ))}
                    <th className="total-column">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => {
                    const own = weekShifts.filter(
                      (s) => s.employeeId === employee.id,
                    );
                    return (
                      <tr key={employee.id}>
                        <th scope="row">
                          <div className="schedule-person">
                            <Avatar employee={employee} size="sm" />
                            <div>
                              <strong>{personName(employee)}</strong>
                              <span>{employee.position}</span>
                            </div>
                          </div>
                        </th>
                        {days.map((day) => {
                          const date = format(day, "yyyy-MM-dd");
                          const daily = own
                            .filter((s) => s.date === date)
                            .sort((a, b) =>
                              a.startTime.localeCompare(b.startTime),
                            );
                          return (
                            <ScheduleCell
                              key={date}
                              employee={employee}
                              date={date}
                              today={isToday(day)}
                              canEdit={isAdmin && employee.active}
                              onAdd={() =>
                                setEditing({
                                  employeeId: employee.id,
                                  date,
                                  role: employee.position,
                                })
                              }
                            >
                              {daily.map((shift) => (
                                <DraggableShift
                                  key={shift.id}
                                  shift={shift}
                                  employee={employee}
                                  canEdit={isAdmin}
                                  onClick={() => setEditing(shift)}
                                />
                              ))}
                            </ScheduleCell>
                          );
                        })}
                        <td className="total-column">
                          <strong>
                            {number(workedHours(own))}
                            <small> h</small>
                          </strong>
                          <span className="small muted">
                            {number((employee.monthlyHours * 12) / 52)} h / sem.
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Couverture par jour</th>
                    {dates.map((date) => (
                      <td key={date}>
                        <span
                          className={`coverage-count ${weekShifts.some((s) => s.date === date) ? "has-coverage" : ""}`}
                        >
                          {
                            new Set(
                              weekShifts
                                .filter((s) => s.date === date && !isAbsent(s))
                                .map((s) => s.employeeId),
                            ).size
                          }
                        </span>
                        <span className="coverage-hours">
                          {number(
                            workedHours(
                              weekShifts.filter((s) => s.date === date),
                            ),
                          )}{" "}
                          h
                        </span>
                      </td>
                    ))}
                    <td className="total-column">
                      <strong>{number(workedHours(weekShifts))} h</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!visibleEmployees.length && (
              <EmptyState
                icon={<Users />}
                title="Aucun membre trouvé"
                description="Modifiez votre recherche ou votre département."
                action={
                  <Button
                    onClick={() => {
                      setQuery("");
                      setDepartment("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                }
              />
            )}
            <div className="schedule-footer">
              <span>
                <span className="status-dot" />
                {isAdmin ? "Le planning de votre équipe" : "Vos services planifiés"}
              </span>
              <span>
                {isAdmin
                  ? "Glissez un service pour le déplacer"
                  : "Cliquez sur un service pour le consulter"}
              </span>
            </div>
          </div>
          <DragOverlay>
            {draggedId &&
              (() => {
                const shift = shifts.find((s) => s.id === draggedId);
                const employee = employees.find(
                  (e) => e.id === shift?.employeeId,
                );
                return shift && employee ? (
                  <div
                    className={`shift-card drag-preview tone-${toneFor(employee.department)}`}
                  >
                    <strong>
                      {shift.startTime} – {shift.endTime}
                    </strong>
                    <span>{personName(employee)}</span>
                  </div>
                ) : null;
              })()}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="agenda-view">
          <SelectionGroup
            className="day-selector"
            value={selectedDay}
            label="Jour de l’agenda"
          >
            {days.map((day) => {
              const date = format(day, "yyyy-MM-dd");
              return (
                <button
                  key={date}
                  className={selectedDay === date ? "active" : ""}
                  aria-pressed={selectedDay === date}
                  onClick={() => setSelectedDay(date)}
                >
                  <span>{format(day, "EEE", { locale: fr })}</span>
                  <strong>{format(day, "d")}</strong>
                  <small>
                    {weekShifts.filter((s) => s.date === date).length} service
                    {weekShifts.filter((s) => s.date === date).length > 1
                      ? "s"
                      : ""}
                  </small>
                </button>
              );
            })}
          </SelectionGroup>
          <DayTimeline
            date={selectedDay}
            employees={visibleEmployees}
            shifts={weekShifts}
            onShift={(shift) => setEditing(shift)}
          />
        </div>
      )}
      <div className="planning-bottom">
        <div className="department-legend">
          <span>Départements</span>
          {[...new Set(visibleEmployees.map((e) => e.department))].map(
            (dept) => (
              <span key={dept}>
                <i className={`department-dot tone-${toneFor(dept)}`} />
                {dept.split("/")[0]}
              </span>
            ),
          )}
        </div>
        <span className="small muted">
          Les horaires de fin peuvent être le lendemain.
        </span>
      </div>
      <div className="planning-note">
        <span className="note-icon">
          <CalendarDays size={20} />
        </span>
        <div>
          <strong>La semaine prend forme.</strong>
          <p>
            {weekShifts.length
              ? `${weekShifts.length} service${weekShifts.length > 1 ? "s" : ""} sur ${new Set(weekShifts.map((s) => s.date)).size} jour${new Set(weekShifts.map((s) => s.date)).size > 1 ? "s" : ""}. ${activePeople} membre${activePeople > 1 ? "s" : ""} au programme.`
              : "Commencez par ajouter un service, puis construisez la semaine à votre rythme."}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            onClick={() => setEditing({ date: selectedDay })}
            disabled={!employees.some((e) => e.active)}
          >
            Planifier un service
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
      {editing && (
        <ShiftEditor
          key={
            editing.id ||
            `${editing.employeeId || "new"}:${editing.date || "today"}`
          }
          shift={editing}
          employees={employees}
          shifts={shifts}
          readOnly={!isAdmin}
          onClose={() => setEditing(null)}
          onSave={async (shift) => {
            await onSaveShifts([shift]);
            setEditing(null);
            notify("Service enregistré.");
          }}
          onDelete={async (shift) => {
            await onDeleteShift(shift);
            setEditing(null);
            notify("Service supprimé.");
          }}
          onDuplicate={(shift) =>
            setEditing({
              ...shift,
              id: undefined,
              revision: undefined,
              date: format(
                addDays(new Date(`${shift.date}T12:00:00`), 1),
                "yyyy-MM-dd",
              ),
              status: "scheduled",
            })
          }
        />
      )}
      {copyWeek && (
        <Modal
          title="Préparer la semaine suivante"
          description={`Copier ${weekShifts.length} service${weekShifts.length > 1 ? "s" : ""} vers la semaine du ${format(addWeeks(week, 1), "d MMMM", { locale: fr })}.`}
          onClose={() => { if (!copying.pending) setCopyWeek(false); }}
        >
          <div className="info-note">
            <Copy size={18} />
            <p>
              Les horaires et les membres sont conservés. Les statuts repassent
              à « Prévu ». Les doublons et les horaires en conflit sont ignorés.
            </p>
          </div>
          {copying.error && <p className="form-error" role="alert">{copying.error}</p>}
          <div className="dialog-footer">
            <Button disabled={copying.pending} onClick={() => setCopyWeek(false)}>Annuler</Button>
            <Button variant="primary" disabled={copying.pending} onClick={() => void copying.run(duplicateWeek)}>
              <Copy size={16} />
              {copying.pending ? "Copie en cours…" : "Copier les services"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function MobileDayPlanning({
  days,
  selectedDay,
  onDay,
  employees,
  shifts,
  canEdit,
  onEdit,
}: {
  days: Date[];
  selectedDay: string;
  onDay: (day: string) => void;
  employees: Employee[];
  shifts: Shift[];
  canEdit: boolean;
  onEdit: (shift: Partial<Shift>) => void;
}) {
  const rosterRef = useContentTransition<HTMLDivElement>(selectedDay);
  const daily = shifts.filter((s) => s.date === selectedDay);
  const ordered = [...employees].sort(
    (a, b) =>
      Number(daily.some((s) => s.employeeId === b.id)) -
      Number(daily.some((s) => s.employeeId === a.id)),
  );
  return (
    <div className="mobile-schedule">
      <SelectionGroup
        className="day-selector"
        value={selectedDay}
        label="Jour du planning"
      >
        {days.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          return (
            <button
              key={date}
              aria-pressed={date === selectedDay}
              className={date === selectedDay ? "active" : ""}
              onClick={() => onDay(date)}
            >
              <span>{format(day, "EEE", { locale: fr }).replace(".", "")}</span>
              <strong>{format(day, "d")}</strong>
              <small>{shifts.filter((s) => s.date === date).length}</small>
            </button>
          );
        })}
      </SelectionGroup>
      <div className="mobile-day-heading">
        <h2>
          {format(new Date(`${selectedDay}T12:00:00`), "EEEE d MMMM", {
            locale: fr,
          })}
        </h2>
        <Badge>
          {daily.length} service{daily.length > 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="mobile-roster" ref={rosterRef}>
        {ordered.map((employee) => {
          const own = daily
            .filter((s) => s.employeeId === employee.id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <article key={employee.id} className="mobile-member">
              <div className="mobile-person">
                <Avatar employee={employee} size="sm" />
                <div>
                  <strong>{personName(employee)}</strong>
                  <small>{employee.position}</small>
                </div>
                {!own.length && <span>Repos</span>}
                {canEdit && employee.active && (
                  <IconButton
                    label={`Ajouter un service pour ${personName(employee)}`}
                    onClick={() =>
                      onEdit({
                        employeeId: employee.id,
                        date: selectedDay,
                        role: employee.position,
                      })
                    }
                  >
                    <Plus size={16} />
                  </IconButton>
                )}
              </div>
              {own.map((shift) => (
                <button
                  key={shift.id}
                  className={`mobile-service tone-${toneFor(employee.department)}`}
                  onClick={() => onEdit(shift)}
                >
                  <Moon size={16} />
                  <div>
                    <strong>
                      {shift.startTime} — {shift.endTime}
                    </strong>
                    <small>{isAbsent(shift) ? "Absence" : shift.role}</small>
                  </div>
                  <span>{number(shiftHours(shift))} h</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </article>
          );
        })}
        {!ordered.length && (
          <EmptyState
            title="Aucun membre trouvé"
            description="Modifiez les filtres pour afficher votre équipe."
          />
        )}
      </div>
    </div>
  );
}
function ScheduleCell({
  employee,
  date,
  today,
  canEdit,
  onAdd,
  children,
}: {
  employee: Employee;
  date: string;
  today: boolean;
  canEdit: boolean;
  onAdd: () => void;
  children: ReactNode[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${employee.id}:${date}`,
    data: { employeeId: employee.id, date },
    disabled: !canEdit,
  });
  return (
    <td
      ref={setNodeRef}
      className={`schedule-cell ${today ? "today-column" : ""} ${isOver ? "drop-target" : ""}`}
    >
      <div className="cell-content">
        {children}
        {canEdit ? (
          <button
            className={`add-cell ${children.length ? "has-shifts" : ""}`}
            onClick={onAdd}
            aria-label={`Ajouter un service pour ${personName(employee)} le ${date}`}
          >
            <Plus size={14} />
            <span>{children.length ? "Ajouter" : "Repos"}</span>
          </button>
        ) : (
          !children.length && <span className="rest-label">Repos</span>
        )}
      </div>
    </td>
  );
}
function DraggableShift({
  shift,
  employee,
  canEdit,
  onClick,
}: {
  shift: Shift;
  employee: Employee;
  canEdit: boolean;
  onClick: () => void;
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    disabled: !canEdit,
  });
  return (
    <button
      ref={setNodeRef}
      {...(canEdit ? listeners : {})}
      type="button"
      className={`shift-card tone-${toneFor(employee.department)} ${isAbsent(shift) ? "shift-absent" : ""} ${isDragging ? "is-dragging" : ""}`}
      onClick={onClick}
      aria-label={`${personName(employee)}, ${shift.date}, ${shift.startTime} à ${shift.endTime}, ${shift.role}. ${canEdit ? "Modifier le service" : "Consulter le service"}`}
    >
      <strong>
        {shift.startTime}
        <span> – </span>
        {shift.endTime}
      </strong>
      <span>{shift.role}</span>
      <small>
        {isAbsent(shift) ? (
          "Absence"
        ) : shift.status === "present" ? (
          <>
            <Check size={11} />
            Présent
          </>
        ) : (
          <>
            <Moon size={11} />
            {number(shiftHours(shift))} h
          </>
        )}
      </small>
    </button>
  );
}
export function DayTimeline({
  date,
  employees,
  shifts,
  onShift,
}: {
  date: string;
  employees: Employee[];
  shifts: Shift[];
  onShift?: (shift: Shift) => void;
}) {
  const timelineRef = useContentTransition<HTMLElement>(date);
  useTimelineReveal(timelineRef, date);
  const daily = shifts.filter(
    (s) => s.date === date && employees.some((e) => e.id === s.employeeId),
  );
  const people = employees.filter((e) =>
    daily.some((s) => s.employeeId === e.id),
  );
  const start = Math.min(
    18,
    ...daily.map((s) => Math.floor(minutes(s.startTime) / 60)),
  );
  const end = Math.max(
    31,
    ...daily.map((s) => minutes(s.startTime) / 60 + shiftHours(s)),
  );
  const total = end - start;
  const labels = Array.from(
    { length: Math.floor(total / 2) + 1 },
    (_, i) => start + i * 2,
  );
  return (
    <section className="timeline-panel" ref={timelineRef}>
      <div className="section-heading">
        <div>
          <h2>Le fil de la soirée</h2>
          <p>
            {format(new Date(`${date}T12:00:00`), "EEEE d MMMM", {
              locale: fr,
            })}{" "}
            · {daily.length} service{daily.length > 1 ? "s" : ""}
          </p>
        </div>
        <Badge>
          <Moon size={12} />
          Jusqu’au lendemain
        </Badge>
      </div>
      {!daily.length ? (
        <EmptyState
          icon={<Moon size={23} />}
          title="Aucun service ce jour-là"
          description="Sélectionnez une autre journée ou ajoutez un service."
        />
      ) : (
        <div
          className="timeline-scroll"
          tabIndex={0}
          role="region"
          aria-label="Frise horaire défilante"
        >
          <div
            className="timeline-content"
            style={{ "--time-columns": labels.length - 1 } as CSSProperties}
          >
            {people.map((employee) => (
              <div className="timeline-row" key={employee.id}>
                <div className="timeline-person">
                  <Avatar employee={employee} size="xs" />
                  <span>
                    {employee.firstName}
                    <small>{employee.department.split("/")[0]}</small>
                  </span>
                </div>
                <div className="timeline-track">
                  {daily
                    .filter((s) => s.employeeId === employee.id)
                    .map((shift) => {
                      const style = {
                        left: `${((minutes(shift.startTime) / 60 - start) / total) * 100}%`,
                        width: `${(shiftHours(shift) / total) * 100}%`,
                      };
                      const content = (
                        <>
                          <span>
                            {shift.startTime} – {shift.endTime}
                          </span>
                          <strong>
                            {isAbsent(shift)
                              ? "Absent"
                              : `${number(shiftHours(shift))} h`}
                          </strong>
                        </>
                      );
                      return onShift ? (
                        <button
                          key={shift.id}
                          className={`timeline-event tone-${toneFor(employee.department)}`}
                          style={style}
                          onClick={() => onShift(shift)}
                          aria-label={`${personName(employee)}, ${shift.startTime} à ${shift.endTime}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div
                          key={shift.id}
                          className={`timeline-event tone-${toneFor(employee.department)}`}
                          style={style}
                        >
                          {content}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            <div className="timeline-axis">
              <span>Heure locale</span>
              <div>
                {labels.map((hour) => (
                  <span
                    key={hour}
                    style={{ left: `${((hour - start) / total) * 100}%` }}
                  >
                    {String(hour % 24).padStart(2, "0")} h
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
function ShiftEditor({
  shift,
  employees,
  shifts,
  readOnly,
  onSave,
  onDelete,
  onClose,
  onDuplicate,
}: {
  shift: Partial<Shift>;
  employees: Employee[];
  shifts: Shift[];
  readOnly: boolean;
  onSave: (shift: Shift) => Promise<void>;
  onDelete: (shift: Shift) => Promise<void>;
  onClose: () => void;
  onDuplicate: (shift: Shift) => void;
}) {
  const defaults =
    employees.find((e) => e.id === shift.employeeId) ||
    employees.find((e) => e.active && e.role !== "admin") ||
    employees.find((e) => e.active);
  const [form, setForm] = useState<Shift>({
    id: shift.id || generateId(),
    revision: shift.revision,
    employeeId: shift.employeeId || defaults?.id || "",
    date: shift.date || format(new Date(), "yyyy-MM-dd"),
    startTime: shift.startTime || "22:00",
    endTime: shift.endTime || "05:00",
    role: shift.role || defaults?.position || "",
    notes: shift.notes || "",
    status: shift.status || "scheduled",
    isNightShift: shift.isNightShift,
  });
  const { pending, error, setError, run } = useAsyncAction();
  const [deleting, setDeleting] = useState(false);

  const change = (key: keyof Shift, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.employeeId) {
      setError("Sélectionnez un membre.");
      return;
    }
    if (!shiftHours(form)) {
      setError("Les heures de début et de fin doivent être différentes.");
      return;
    }
    if (overlaps(form, shifts)) {
      setError(
        "Ce membre a déjà un service sur cet horaire. Modifiez les heures ou choisissez un autre jour.",
      );
      return;
    }
    void run(() => onSave(form));
  };
  const person = employees.find((e) => e.id === form.employeeId);
  return (
    <Modal
      title={
        readOnly
          ? "Votre service"
          : shift.id
            ? "Modifier le service"
            : "Un nouveau service"
      }
      description={
        readOnly
          ? "Les informations de votre prochain service."
          : "Quelques détails pour une soirée bien préparée."
      }
      onClose={() => { if (!pending) onClose(); }}
    >
      <form onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending}>
        <fieldset disabled={readOnly} className="form-fields">
          <label className="field">
            Membre de l’équipe
            <select
              value={form.employeeId}
              onChange={(e) => {
                change("employeeId", e.target.value);
                change(
                  "role",
                  employees.find((emp) => emp.id === e.target.value)
                    ?.position || "",
                );
              }}
              required
            >
              {employees
                .filter((e) => e.active || e.id === form.employeeId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {personName(e)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Date de début
            <input
              type="date"
              value={form.date}
              onChange={(e) => change("date", e.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Début
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => change("startTime", e.target.value)}
                required
              />
            </label>
            <label className="field">
              Fin
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => change("endTime", e.target.value)}
                required
              />
            </label>
          </div>
          <div className="duration-preview">
            <Clock3 size={16} />
            <strong>{number(shiftHours(form))} heures</strong>
            <span>
              {minutes(form.endTime) < minutes(form.startTime)
                ? "Fin le lendemain"
                : "Sur la même journée"}
            </span>
          </div>
          <label className="field">
            Poste
            <input
              value={form.role}
              onChange={(e) => change("role", e.target.value)}
              required
            />
          </label>
          <label className="field">
            Présence
            <select
              value={form.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="scheduled">Prévu</option>
              <option value="present">Présent</option>
              <option value="absence_justified">Absence justifiée</option>
              <option value="absence_unjustified">Absence injustifiée</option>
            </select>
          </label>
          <label className="field">
            Note <span className="optional">facultatif</span>
            <textarea
              value={form.notes}
              onChange={(e) => change("notes", e.target.value)}
              rows={2}
              placeholder="Une information utile pour ce service…"
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {deleting ? (
          <div className="delete-confirm">
            <p>
              Supprimer le service de {person?.firstName} le{" "}
              {format(new Date(`${form.date}T12:00:00`), "d MMMM", {
                locale: fr,
              })}{" "}
              ?
            </p>
            <div>
              <Button onClick={() => setDeleting(false)}>Conserver</Button>
              <Button variant="danger" onClick={() => void run(() => onDelete(form))}>
                Confirmer la suppression
              </Button>
            </div>
          </div>
        ) : (
          <div className="dialog-footer">
            {!readOnly && shift.id && (
              <>
                <IconButton
                  label="Supprimer le service"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={16} />
                </IconButton>
                <IconButton
                  label="Dupliquer le service au lendemain"
                  onClick={() => onDuplicate(form)}
                >
                  <Copy size={16} />
                </IconButton>
              </>
            )}
            <span className="flex-spacer" />
            <Button onClick={onClose}>{readOnly ? "Fermer" : "Annuler"}</Button>
            {!readOnly && (
              <Button variant="primary" type="submit">
                <Check size={15} />
                {pending ? "Enregistrement…" : shift.id ? "Enregistrer" : "Créer le service"}
              </Button>
            )}
          </div>
        )}
        </fieldset>
      </form>
    </Modal>
  );
}
