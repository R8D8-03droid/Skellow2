import { useEffect, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDaysInMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowDownToLine,
  ArrowRight,
  Calculator,
  Check,
  FileSpreadsheet,
  FileText,
  Info,
  Moon,
} from "lucide-react";
import { Employee, Shift, PaySlip } from "../types";
import {
  IDCC_1790_RULES,
  calculateOvertime,
  calculateNightHours,
} from "../idcc1790";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  PageHeader,
  money,
  number,
  personName,
} from "./ui";
interface GeneratedPaySlip extends PaySlip {
  employee: Employee;
}
export default function PaySlipGenerator({
  employees,
  shifts,
  notify,
}: {
  employees: Employee[];
  shifts: Shift[];
  notify: (message: string, tone?: "success" | "error") => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatedSlips, setGeneratedSlips] = useState<GeneratedPaySlip[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [detail, setDetail] = useState<GeneratedPaySlip | null>(null);
  const [exporting, setExporting] = useState(false);
  const activeEmployees = employees.filter((e) => e.active);
  useEffect(() => {
    setGeneratedSlips([]);
    setDetail(null);
  }, [selectedMonth, selectedYear, selectedEmployee, employees, shifts]);
  const calculateMonthlyHours = (
    employeeId: string,
    month: number,
    year: number,
  ) => {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    let totalMinutes = 0;
    let nightMinutes = 0;

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayShifts = shifts.filter(
        (s) => s.employeeId === employeeId && s.date === dateStr,
      );
      dayShifts.forEach((shift) => {
        if (
          shift.status === "absence_justified" ||
          shift.status === "absence_unjustified"
        )
          return;
        const [sh, sm] = shift.startTime.split(":").map(Number);
        const [eh, em] = shift.endTime.split(":").map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        totalMinutes += minutes;
        nightMinutes +=
          calculateNightHours(shift.startTime, shift.endTime) * 60;
      });
    });

    const totalHours = totalMinutes / 60;
    const weeksInMonth = getDaysInMonth(new Date(year, month - 1)) / 7;
    const avgWeeklyHours = totalHours / weeksInMonth;
    const overtime = calculateOvertime(avgWeeklyHours);

    return {
      totalHours,
      regularHours: overtime.regular * weeksInMonth,
      overtime25Hours: overtime.overtime25 * weeksInMonth,
      overtime50Hours: overtime.overtime50 * weeksInMonth,
      nightHours: nightMinutes / 60,
    };
  };

  const generatePaySlip = (employee: Employee): GeneratedPaySlip => {
    const {
      totalHours,
      regularHours,
      overtime25Hours,
      overtime50Hours,
      nightHours,
    } = calculateMonthlyHours(employee.id, selectedMonth, selectedYear);
    const baseSalary = regularHours * employee.hourlyRate;
    const overtime25Pay = overtime25Hours * employee.hourlyRate * 1.25;
    const overtime50Pay = overtime50Hours * employee.hourlyRate * 1.5;
    const nightBonus = nightHours * IDCC_1790_RULES.nightWorkBonus;
    const grossSalary = baseSalary + overtime25Pay + overtime50Pay + nightBonus;
    const socialCharges = grossSalary * 0.22;
    const netSalary = grossSalary - socialCharges;

    return {
      id: `payslip-${employee.id}-${selectedYear}-${selectedMonth}`,
      employeeId: employee.id,
      month: selectedMonth,
      year: selectedYear,
      totalHours,
      regularHours,
      overtime25Hours,
      overtime50Hours,
      nightHours,
      baseSalary,
      overtime25Pay,
      overtime50Pay,
      nightBonus,
      grossSalary,
      socialCharges,
      netSalary,
      generatedAt: new Date().toISOString(),
      employee,
    };
  };

  const handleGenerate = () => {
    const toProcess =
      selectedEmployee === "all"
        ? activeEmployees
        : activeEmployees.filter((e) => e.id === selectedEmployee);
    setGeneratedSlips(toProcess.map((emp) => generatePaySlip(emp)));
    notify("La préparation de paie a été calculée.");
  };

  const generateExcel = async () => {
    if (generatedSlips.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const data = [
      [
        "Nom",
        "Prenom",
        "Poste",
        "Heures totales",
        "Heures normales",
        "HS 25%",
        "HS 50%",
        "Heures nuit",
        "Brut",
        "Charges",
        "Net",
      ],
      ...generatedSlips.map((s) => [
        s.employee.lastName,
        s.employee.firstName,
        s.employee.position,
        +s.totalHours.toFixed(2),
        +s.regularHours.toFixed(2),
        +s.overtime25Hours.toFixed(2),
        +s.overtime50Hours.toFixed(2),
        +s.nightHours.toFixed(2),
        +s.grossSalary.toFixed(2),
        +s.socialCharges.toFixed(2),
        +s.netSalary.toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Paie");
    XLSX.writeFile(
      wb,
      `paie_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xlsx`,
    );
  };

  const pdf = async (slip: GeneratedPaySlip) => {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFontSize(24);
    doc.text("skellow.", 18, 22);
    doc.setFontSize(14);
    doc.text("Préparation de paie — estimation", 18, 37);
    doc.setFontSize(11);
    doc.text(
      `${personName(slip.employee)} | ${format(new Date(slip.year, slip.month - 1), "MMMM yyyy", { locale: fr })}`,
      18,
      47,
    );
    autoTable(doc, {
      startY: 57,
      head: [["Élément", "Volume", "Montant"]],
      body: [
        [
          "Heures normales",
          `${slip.regularHours.toFixed(2)} h`,
          `${slip.baseSalary.toFixed(2)} EUR`,
        ],
        [
          "Heures supplémentaires 25 %",
          `${slip.overtime25Hours.toFixed(2)} h`,
          `${slip.overtime25Pay.toFixed(2)} EUR`,
        ],
        [
          "Heures supplémentaires 50 %",
          `${slip.overtime50Hours.toFixed(2)} h`,
          `${slip.overtime50Pay.toFixed(2)} EUR`,
        ],
        [
          "Prime de nuit",
          `${slip.nightHours.toFixed(2)} h`,
          `${slip.nightBonus.toFixed(2)} EUR`,
        ],
        ["Total brut estimé", "", `${slip.grossSalary.toFixed(2)} EUR`],
        [
          "Cotisations estimées (22 %)",
          "",
          `${slip.socialCharges.toFixed(2)} EUR`,
        ],
        ["Net estimé", "", `${slip.netSalary.toFixed(2)} EUR`],
      ],
      theme: "striped",
      headStyles: { fillColor: [49, 62, 54] },
      styles: { font: "helvetica", fontSize: 10, cellPadding: 5 },
      margin: { left: 18, right: 18 },
    });
    doc.setFontSize(9);
    doc.text(
      "Document de préparation. Ne constitue pas un bulletin de paie.",
      18,
      174,
    );
    doc.text(
      "Les calculs et cotisations doivent être validés par votre gestionnaire de paie.",
      18,
      181,
    );
    doc.save(
      `preparation-${slip.employee.lastName}-${slip.year}-${String(slip.month).padStart(2, "0")}.pdf`,
    );
  };
  const safeExport = async (action: () => Promise<void>) => {
    setExporting(true);
    try {
      await action();
      notify("Votre export est prêt.");
    } catch {
      notify("L’export a échoué. Réessayez dans un instant.", "error");
    } finally {
      setExporting(false);
    }
  };
  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  const sums = {
    gross: generatedSlips.reduce((s, v) => s + v.grossSalary, 0),
    charges: generatedSlips.reduce((s, v) => s + v.socialCharges, 0),
    net: generatedSlips.reduce((s, v) => s + v.netSalary, 0),
  };
  return (
    <div className="page payroll-page">
      <PageHeader
        title="La paie, en toute clarté."
        description="Retrouvez les heures, les majorations et les éléments à transmettre."
      >
        <Badge tone="sage">
          <FileText size={13} />
          Préparation de paie
        </Badge>
      </PageHeader>
      <div className="page-tabs">
        <div className="tab-buttons">
          <span className="active">
            <Calculator size={16} />
            Calcul mensuel
          </span>
        </div>
        <span className="small muted">Paramétrage existant · IDCC 1790</span>
      </div>
      <section className="payroll-controls panel">
        <div className="section-heading">
          <div>
            <h2>Commençons par la période.</h2>
            <p>Les heures sont calculées à partir des services du planning.</p>
          </div>
          <span className="large-icon">
            <CalendarIcon />
          </span>
        </div>
        <div className="payroll-form">
          <label className="field">
            Mois
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Année
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {Array.from(
                { length: 7 },
                (_, i) => new Date().getFullYear() - 3 + i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Membres
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="all">
                Toute l’équipe ({activeEmployees.length})
              </option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {personName(e)}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!activeEmployees.length}
          >
            <Calculator size={16} />
            Calculer la préparation
          </Button>
        </div>
      </section>
      {generatedSlips.length ? (
        <>
          <div className="payroll-summary">
            <div>
              <span>Brut estimé</span>
              <strong>{money(sums.gross)}</strong>
            </div>
            <div>
              <span>Cotisations estimées</span>
              <strong>{money(sums.charges)}</strong>
            </div>
            <div>
              <span>Net estimé</span>
              <strong>{money(sums.net)}</strong>
            </div>
          </div>
          <div className="section-toolbar">
            <div>
              <h2>
                {months[selectedMonth - 1]} {selectedYear}
              </h2>
              <p className="small muted">
                {generatedSlips.length} préparations disponibles
              </p>
            </div>
            <Button
              onClick={() => safeExport(generateExcel)}
              disabled={exporting}
            >
              <FileSpreadsheet size={16} />
              {exporting ? "Export en cours…" : "Exporter en Excel"}
            </Button>
          </div>
          <div className="table-panel">
            <table className="data-table payroll-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Heures</th>
                  <th>Nuit</th>
                  <th>HS 25 %</th>
                  <th>HS 50 %</th>
                  <th>Brut estimé</th>
                  <th>Net estimé</th>
                  <th>
                    <span className="sr-only">Détails</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {generatedSlips.map((slip) => (
                  <tr key={slip.id}>
                    <td>
                      <button
                        className="table-person"
                        onClick={() => setDetail(slip)}
                      >
                        <Avatar employee={slip.employee} size="sm" />
                        <span>
                          <strong>{personName(slip.employee)}</strong>
                          <small>{slip.employee.position}</small>
                        </span>
                      </button>
                    </td>
                    <td className="numeric">{number(slip.totalHours)} h</td>
                    <td className="numeric">{number(slip.nightHours)} h</td>
                    <td className="numeric">
                      {number(slip.overtime25Hours)} h
                    </td>
                    <td className="numeric">
                      {number(slip.overtime50Hours)} h
                    </td>
                    <td className="numeric">{money(slip.grossSalary)}</td>
                    <td className="numeric payroll-net">
                      {money(slip.netSalary)}
                    </td>
                    <td>
                      <IconButton
                        label={`Détails de la paie de ${personName(slip.employee)}`}
                        onClick={() => setDetail(slip)}
                      >
                        <ArrowRight size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="payroll-empty panel">
          <div className="paper-stack" aria-hidden="true">
            <span />
            <span />
            <div>
              <FileText size={27} />
              <i />
              <i />
              <i />
            </div>
          </div>
          <h2>Une fin de mois bien préparée.</h2>
          <p>
            Sélectionnez votre période et vos membres.
            <br />
            Skellow rassemble les éléments du planning pour vous.
          </p>
          <div className="payroll-steps">
            <span>
              <Check size={14} />
              Heures du planning
            </span>
            <span>
              <Moon size={14} />
              Travail de nuit
            </span>
            <span>
              <ArrowDownToLine size={14} />
              Exports Excel et PDF
            </span>
          </div>
        </section>
      )}
      <div className="info-note payroll-disclaimer">
        <Info size={18} />
        <p>
          Ces montants sont des estimations basées sur le paramétrage existant,
          avec des cotisations forfaitaires de 22 %. Faites valider les éléments
          par votre gestionnaire de paie avant d’établir les bulletins.
        </p>
      </div>
      {detail && (
        <Modal
          title="Détail de la préparation"
          description={`${personName(detail.employee)} · ${months[detail.month - 1]} ${detail.year}`}
          onClose={() => setDetail(null)}
        >
          <div className="payroll-detail">
            {[
              [
                "Heures normales",
                `${number(detail.regularHours)} h`,
                money(detail.baseSalary),
              ],
              [
                "Heures supplémentaires à 25 %",
                `${number(detail.overtime25Hours)} h`,
                money(detail.overtime25Pay),
              ],
              [
                "Heures supplémentaires à 50 %",
                `${number(detail.overtime50Hours)} h`,
                money(detail.overtime50Pay),
              ],
              [
                "Prime de nuit",
                `${number(detail.nightHours)} h`,
                money(detail.nightBonus),
              ],
            ].map(([label, hours, value]) => (
              <div key={label}>
                <span>
                  {label}
                  <small>{hours}</small>
                </span>
                <strong>{value}</strong>
              </div>
            ))}
            <div>
              <span>Brut estimé</span>
              <strong>{money(detail.grossSalary)}</strong>
            </div>
            <div>
              <span>Cotisations estimées</span>
              <strong>− {money(detail.socialCharges)}</strong>
            </div>
            <div className="payroll-net">
              <span>Net estimé</span>
              <strong>{money(detail.netSalary)}</strong>
            </div>
          </div>
          <div className="dialog-footer">
            <Button onClick={() => setDetail(null)}>Fermer</Button>
            <Button
              variant="primary"
              disabled={exporting}
              onClick={() => safeExport(() => pdf(detail))}
            >
              <ArrowDownToLine size={16} />
              {exporting ? "Export…" : "Exporter en PDF"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function CalendarIcon() {
  return <FileText size={22} />;
}
