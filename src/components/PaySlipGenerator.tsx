import { useState } from 'react';
import { Employee, Shift, PaySlip } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaySlipGeneratorProps {
  employees: Employee[];
  shifts: Shift[];
}

interface GeneratedPaySlip extends PaySlip {
  employee: Employee;
}

export default function PaySlipGenerator({ employees, shifts }: PaySlipGeneratorProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatedSlips, setGeneratedSlips] = useState<GeneratedPaySlip[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  const activeEmployees = employees.filter((e) => e.active && e.role === 'employee');

  const calculateMonthlyHours = (employeeId: string, month: number, year: number) => {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let totalMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    const monthlyContractHours = employees.find(e => e.id === employeeId)?.monthlyHours || 151.67;
    const contractMinutes = monthlyContractHours * 60;

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter((s) => s.employeeId === employeeId && s.date === dateStr);
      dayShifts.forEach((shift) => {
        const [sh, sm] = shift.startTime.split(':').map(Number);
        const [eh, em] = shift.endTime.split(':').map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        totalMinutes += minutes;
      });
    });

    if (totalMinutes > contractMinutes) {
      regularMinutes = contractMinutes;
      overtimeMinutes = totalMinutes - contractMinutes;
    } else {
      regularMinutes = totalMinutes;
      overtimeMinutes = 0;
    }

    return {
      totalHours: totalMinutes / 60,
      regularHours: regularMinutes / 60,
      overtimeHours: overtimeMinutes / 60,
    };
  };

  const generatePaySlip = (employee: Employee): GeneratedPaySlip => {
    const { totalHours, regularHours, overtimeHours } = calculateMonthlyHours(
      employee.id,
      selectedMonth,
      selectedYear
    );

    const baseSalary = regularHours * employee.hourlyRate;
    const overtimeRate = employee.hourlyRate * 1.25; // 25% majoration
    const overtimePay = overtimeHours * overtimeRate;
    const grossSalary = baseSalary + overtimePay;
    
    // Charges sociales approximatives (~22% salariales)
    const socialCharges = grossSalary * 0.22;
    const netSalary = grossSalary - socialCharges;

    return {
      id: `payslip-${employee.id}-${selectedYear}-${selectedMonth}`,
      employeeId: employee.id,
      month: selectedMonth,
      year: selectedYear,
      totalHours,
      overtimeHours,
      baseSalary,
      overtimePay,
      grossSalary,
      socialCharges,
      netSalary,
      generatedAt: new Date().toISOString(),
      employee,
    };
  };

  const handleGenerate = () => {
    const employeesToProcess = selectedEmployee === 'all'
      ? activeEmployees
      : activeEmployees.filter((e) => e.id === selectedEmployee);

    const slips = employeesToProcess.map((emp) => generatePaySlip(emp));
    setGeneratedSlips(slips);
  };

  const generatePDF = (slip: GeneratedPaySlip) => {
    const doc = new jsPDF();
    const { employee } = slip;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(180, 83, 9);
    doc.text('Hôtel Restaurant & Spa', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('12 Rue de la Paix, 75001 Paris', 105, 28, { align: 'center' });
    doc.text('SIRET: 123 456 789 00012 - APE: 5510Z', 105, 34, { align: 'center' });

    // Line
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.5);
    doc.line(20, 40, 190, 40);

    // Title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('BULLETIN DE PAIE', 105, 50, { align: 'center' });
    
    const monthName = format(new Date(slip.year, slip.month - 1), 'MMMM yyyy', { locale: fr });
    doc.setFontSize(11);
    doc.text(`Période : ${monthName}`, 105, 58, { align: 'center' });

    // Employee info
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const leftX = 20;
    let y = 72;
    
    doc.setFont('helvetica', 'bold');
    doc.text('SALARIÉ(E)', leftX, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`Nom : ${employee.lastName} ${employee.firstName}`, leftX, y); y += 5;
    doc.text(`Adresse : ${employee.address}, ${employee.postalCode} ${employee.city}`, leftX, y); y += 5;
    doc.text(`N° SS : ${employee.socialSecurityNumber}`, leftX, y); y += 5;
    doc.text(`Emploi : ${employee.position}`, leftX, y); y += 5;
    doc.text(`Contrat : ${employee.contractType}`, leftX, y); y += 5;
    doc.text(`Dept : ${employee.department}`, leftX, y); y += 5;
    doc.text(`Date d'entrée : ${format(new Date(employee.startDate), 'dd/MM/yyyy')}`, leftX, y);

    // Right side info
    const rightX = 120;
    y = 72;
    doc.setFont('helvetica', 'bold');
    doc.text('PÉRIODE', rightX, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const daysInMonth = getDaysInMonth(new Date(slip.year, slip.month - 1));
    doc.text(`Du 01/${String(slip.month).padStart(2, '0')}/${slip.year}`, rightX, y); y += 5;
    doc.text(`au ${daysInMonth}/${String(slip.month).padStart(2, '0')}/${slip.year}`, rightX, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('CONTRAT', rightX, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`Type : ${employee.contractType}`, rightX, y); y += 5;
    doc.text(`Coefficient : -`, rightX, y); y += 5;
    doc.text(`Heures mensuelles : ${employee.monthlyHours.toFixed(2)}h`, rightX, y);

    // Pay table
    y = 130;
    autoTable(doc, {
      startY: y,
      head: [['', 'Base', 'Taux horaire', 'Montant']],
      body: [
        ['Heures normales', `${slip.totalHours - slip.overtimeHours} h`, `${employee.hourlyRate.toFixed(2)} €`, `${slip.baseSalary.toFixed(2)} €`],
        ...(slip.overtimeHours > 0 ? [['Heures sup. (25%)', `${slip.overtimeHours} h`, `${(employee.hourlyRate * 1.25).toFixed(2)} €`, `${slip.overtimePay.toFixed(2)} €`]] : []),
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [180, 83, 9],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
      },
      margin: { left: 20, right: 20 },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(120, finalY, 190, finalY);
    
    doc.setFontSize(9);
    doc.text('SALAIRE BRUT', 120, finalY + 6);
    doc.text(`${slip.grossSalary.toFixed(2)} €`, 175, finalY + 6, { align: 'right' });
    
    doc.text('Charges salariales (22%)', 120, finalY + 13);
    doc.text(`- ${slip.socialCharges.toFixed(2)} €`, 175, finalY + 13, { align: 'right' });
    
    doc.setDrawColor(180, 83, 9);
    doc.setLineWidth(0.5);
    doc.line(120, finalY + 18, 190, finalY + 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('NET À PAYER', 120, finalY + 26);
    doc.text(`${slip.netSalary.toFixed(2)} €`, 175, finalY + 26, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bulletin généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 105, 280, { align: 'center' });
    doc.text('Ce bulletin annule et remplace tout bulletin précédent pour la même période.', 105, 285, { align: 'center' });

    // Save
    doc.save(`bulletin_${employee.lastName}_${employee.firstName}_${monthName.replace(' ', '_')}.pdf`);
  };

  const generateAllPDFs = () => {
    generatedSlips.forEach((slip) => generatePDF(slip));
  };

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <i className="fas fa-file-invoice-dollar text-green-500"></i>
          Fiches de paie
        </h1>
        <p className="text-gray-500 text-sm mt-1">Générez les bulletins de salaire mensuels</p>
      </div>

      {/* Generator Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Paramètres de génération</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tous les employés</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl shadow hover:shadow-lg transition-all"
            >
              <i className="fas fa-calculator mr-2"></i>Calculer
            </button>
          </div>
        </div>
      </div>

      {/* Generated Pay Slips */}
      {generatedSlips.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              Bulletins - {months[selectedMonth - 1]} {selectedYear}
            </h2>
            <button
              onClick={generateAllPDFs}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-xl shadow hover:shadow-lg transition-all"
            >
              <i className="fas fa-download mr-2"></i>Tout télécharger
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {generatedSlips.map((slip) => (
              <div key={slip.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {slip.employee.firstName[0]}{slip.employee.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {slip.employee.firstName} {slip.employee.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{slip.employee.position} • {slip.employee.department}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Heures</p>
                      <p className="font-bold text-gray-800">{slip.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Heures sup.</p>
                      <p className="font-bold text-gray-800">{slip.overtimeHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Brut</p>
                      <p className="font-bold text-gray-800">{slip.grossSalary.toFixed(2)}€</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Charges</p>
                      <p className="font-bold text-red-500">-{slip.socialCharges.toFixed(2)}€</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Net</p>
                      <p className="font-bold text-green-600 text-lg">{slip.netSalary.toFixed(2)}€</p>
                    </div>
                  </div>

                  <button
                    onClick={() => generatePDF(slip)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                  >
                    <i className="fas fa-file-pdf mr-2 text-red-500"></i>PDF
                  </button>
                </div>

                {/* Detail breakdown */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Salaire de base</p>
                    <p className="font-semibold text-gray-700">
                      {(slip.totalHours - slip.overtimeHours).toFixed(1)}h × {slip.employee.hourlyRate.toFixed(2)}€ = {slip.baseSalary.toFixed(2)}€
                    </p>
                  </div>
                  {slip.overtimeHours > 0 && (
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-amber-500 mb-1">Heures supplémentaires (25%)</p>
                      <p className="font-semibold text-amber-700">
                        {slip.overtimeHours.toFixed(1)}h × {(slip.employee.hourlyRate * 1.25).toFixed(2)}€ = {slip.overtimePay.toFixed(2)}€
                      </p>
                    </div>
                  )}
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-500 mb-1">Net à payer</p>
                    <p className="font-bold text-green-700 text-lg">{slip.netSalary.toFixed(2)}€</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500">Masse salariale brute</p>
                <p className="text-xl font-bold text-gray-800">
                  {generatedSlips.reduce((sum, s) => sum + s.grossSalary, 0).toFixed(2)}€
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Total charges</p>
                <p className="text-xl font-bold text-red-500">
                  {generatedSlips.reduce((sum, s) => sum + s.socialCharges, 0).toFixed(2)}€
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Masse salariale nette</p>
                <p className="text-xl font-bold text-green-600">
                  {generatedSlips.reduce((sum, s) => sum + s.netSalary, 0).toFixed(2)}€
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {generatedSlips.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="fas fa-calculator text-2xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 font-medium">Sélectionnez un mois et cliquez sur "Calculer"</p>
          <p className="text-gray-400 text-sm mt-1">pour générer les fiches de paie</p>
        </div>
      )}
    </div>
  );
}
