import { useState } from 'react';
import { Employee, Shift, PaySlip } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { IDCC_1790_RULES, calculateOvertime, calculateNightHours } from '../idcc1790';

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
    let nightMinutes = 0;

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter((s) => s.employeeId === employeeId && s.date === dateStr);
      dayShifts.forEach((shift) => {
        // Exclure les absences du calcul des heures
        if (shift.status === 'absence_justified' || shift.status === 'absence_unjustified') {
          return;
        }
        
        const [sh, sm] = shift.startTime.split(':').map(Number);
        const [eh, em] = shift.endTime.split(':').map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        totalMinutes += minutes;
        
        // Calcul des heures de nuit
        nightMinutes += calculateNightHours(shift.startTime, shift.endTime) * 60;
      });
    });

    // Calcul hebdomadaire pour déterminer les heures supplémentaires
    // On simplifie en calculant le total mensuel puis en divisant par le nombre de semaines
    const totalHours = totalMinutes / 60;
    const weeksInMonth = getDaysInMonth(new Date(year, month - 1)) / 7;
    const avgWeeklyHours = totalHours / weeksInMonth;
    
    // Calcul des heures supplémentaires selon IDCC 1790
    const overtime = calculateOvertime(avgWeeklyHours);
    const regularHours = overtime.regular * weeksInMonth;
    const overtime25Hours = overtime.overtime25 * weeksInMonth;
    const overtime50Hours = overtime.overtime50 * weeksInMonth;
    const nightHours = nightMinutes / 60;

    return {
      totalHours,
      regularHours,
      overtime25Hours,
      overtime50Hours,
      nightHours,
    };
  };

  const generatePaySlip = (employee: Employee): GeneratedPaySlip => {
    const { totalHours, regularHours, overtime25Hours, overtime50Hours, nightHours } = calculateMonthlyHours(
      employee.id,
      selectedMonth,
      selectedYear
    );

    // Salaire de base (heures régulières)
    const baseSalary = regularHours * employee.hourlyRate;
    
    // Heures supplémentaires 25% (36h à 43h)
    const overtime25Pay = overtime25Hours * employee.hourlyRate * 1.25;
    
    // Heures supplémentaires 50% (44h+)
    const overtime50Pay = overtime50Hours * employee.hourlyRate * 1.50;
    
    // Prime de nuit (1€ brut par heure de nuit)
    const nightBonus = nightHours * IDCC_1790_RULES.nightWorkBonus;
    
    // Salaire brut total
    const grossSalary = baseSalary + overtime25Pay + overtime50Pay + nightBonus;
    
    // Charges sociales (~22%)
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
    const employeesToProcess = selectedEmployee === 'all'
      ? activeEmployees
      : activeEmployees.filter((e) => e.id === selectedEmployee);

    const slips = employeesToProcess.map((emp) => generatePaySlip(emp));
    setGeneratedSlips(slips);
  };

  const generateExcel = (slips: GeneratedPaySlip[]) => {
    // Créer un workbook
    const wb = XLSX.utils.book_new();

    // Feuille 1: Résumé global
    const summaryData = [
      ['BULLETINS DE PAIE - NIGHT CLUB'],
      ['Convention Collective IDCC 1790 - Espaces de loisirs, d\'attractions et culturels'],
      [],
      ['Période', format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: fr })],
      ['Date d\'export', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['RÉCAPITULATIF GLOBAL'],
      ['Nombre de bulletins', slips.length],
      ['Masse salariale brute', `${slips.reduce((sum, s) => sum + s.grossSalary, 0).toFixed(2)} €`],
      ['Total charges salariales', `${slips.reduce((sum, s) => sum + s.socialCharges, 0).toFixed(2)} €`],
      ['Masse salariale nette', `${slips.reduce((sum, s) => sum + s.netSalary, 0).toFixed(2)} €`],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé');

    // Feuille 2: Détail par employé (format compatible import comptable)
    const detailData = [
      ['DÉTAIL DES BULLETINS DE PAIE'],
      ['Période', format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: fr })],
      [],
      [
        'Nom',
        'Prénom',
        'N° Sécurité Sociale',
        'Poste',
        'Département',
        'Type contrat',
        'Date embauche',
        'Heures totales',
        'Heures normales',
        'Taux horaire base (€)',
        'Salaire base (€)',
        'Heures sup. 25%',
        'Montant HS 25% (€)',
        'Heures sup. 50%',
        'Montant HS 50% (€)',
        'Heures de nuit',
        'Prime nuit (€)',
        'Salaire brut (€)',
        'Charges salariales (€)',
        'Salaire net (€)',
      ]
    ];

    slips.forEach(slip => {
      detailData.push([
        slip.employee.lastName,
        slip.employee.firstName,
        slip.employee.socialSecurityNumber,
        slip.employee.position,
        slip.employee.department,
        slip.employee.contractType,
        format(new Date(slip.employee.startDate), 'dd/MM/yyyy'),
        slip.totalHours.toFixed(2),
        slip.regularHours.toFixed(2),
        slip.employee.hourlyRate.toFixed(2),
        slip.baseSalary.toFixed(2),
        slip.overtime25Hours.toFixed(2),
        slip.overtime25Pay.toFixed(2),
        slip.overtime50Hours.toFixed(2),
        slip.overtime50Pay.toFixed(2),
        slip.nightHours.toFixed(2),
        slip.nightBonus.toFixed(2),
        slip.grossSalary.toFixed(2),
        slip.socialCharges.toFixed(2),
        slip.netSalary.toFixed(2),
      ]);
    });

    // Ligne de totaux
    detailData.push([]);
    detailData.push([
      'TOTAUX',
      '',
      '',
      '',
      '',
      '',
      '',
      slips.reduce((sum, s) => sum + s.totalHours, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.regularHours, 0).toFixed(2),
      '',
      slips.reduce((sum, s) => sum + s.baseSalary, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.overtime25Hours, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.overtime25Pay, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.overtime50Hours, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.overtime50Pay, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.nightHours, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.nightBonus, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.grossSalary, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.socialCharges, 0).toFixed(2),
      slips.reduce((sum, s) => sum + s.netSalary, 0).toFixed(2),
    ]);

    const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
    
    // Ajuster la largeur des colonnes
    wsDetail['!cols'] = [
      { wch: 15 }, // Nom
      { wch: 15 }, // Prénom
      { wch: 20 }, // N° SS
      { wch: 20 }, // Poste
      { wch: 15 }, // Département
      { wch: 12 }, // Type contrat
      { wch: 12 }, // Date embauche
      { wch: 12 }, // Heures totales
      { wch: 12 }, // Heures normales
      { wch: 15 }, // Taux horaire
      { wch: 15 }, // Salaire base
      { wch: 12 }, // HS 25%
      { wch: 15 }, // Montant HS 25%
      { wch: 12 }, // HS 50%
      { wch: 15 }, // Montant HS 50%
      { wch: 12 }, // Heures nuit
      { wch: 12 }, // Prime nuit
      { wch: 15 }, // Brut
      { wch: 15 }, // Charges
      { wch: 15 }, // Net
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail bulletins');

    // Feuille 3: Export comptable (format simplifié pour import)
    const accountingData = [
      ['EXPORT COMPTABLE - Pennylane compatible'],
      ['Journal des salaires'],
      ['Période', format(new Date(selectedYear, selectedMonth - 1), 'MM/yyyy')],
      [],
      ['Date', 'Compte', 'Libellé', 'Débit', 'Crédit', 'N° pièce', 'N° séquentiel'],
    ];

    let seqNum = 1;
    slips.forEach(slip => {
      const pieceNum = `SAL${selectedYear}${String(selectedMonth).padStart(2, '0')}${String(seqNum).padStart(3, '0')}`;
      const dateOp = format(endOfMonth(new Date(selectedYear, selectedMonth - 1)), 'dd/MM/yyyy');
      
      // Ligne de débit (charge de personnel)
      accountingData.push([
        dateOp,
        '641100', // Compte de charge : Rémunérations du personnel
        `Salaires bruts - ${slip.employee.lastName} ${slip.employee.firstName}`,
        slip.grossSalary.toFixed(2),
        '',
        pieceNum,
        String(seqNum),
      ]);

      // Ligne de crédit (charges sociales à payer)
      accountingData.push([
        dateOp,
        '431000', // Compte de passif : Charges sociales
        `Charges sociales - ${slip.employee.lastName} ${slip.employee.firstName}`,
        '',
        slip.socialCharges.toFixed(2),
        pieceNum,
        String(seqNum),
      ]);

      // Ligne de crédit (net à payer)
      accountingData.push([
        dateOp,
        '421000', // Compte de passif : Personnel - Rémunérations dues
        `Net à payer - ${slip.employee.lastName} ${slip.employee.firstName}`,
        '',
        slip.netSalary.toFixed(2),
        pieceNum,
        String(seqNum),
      ]);

      seqNum++;
    });

    const wsAccounting = XLSX.utils.aoa_to_sheet(accountingData);
    wsAccounting['!cols'] = [
      { wch: 12 }, // Date
      { wch: 10 }, // Compte
      { wch: 50 }, // Libellé
      { wch: 15 }, // Débit
      { wch: 15 }, // Crédit
      { wch: 20 }, // N° pièce
      { wch: 12 }, // N° séquentiel
    ];

    XLSX.utils.book_append_sheet(wb, wsAccounting, 'Export comptable');

    // Générer et télécharger le fichier
    const fileName = `bulletins_paie_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const generateCSV = (slips: GeneratedPaySlip[]) => {
    // Format CSV simplifié pour import rapide
    const headers = [
      'Nom',
      'Prénom',
      'N° Sécurité Sociale',
      'Poste',
      'Département',
      'Type contrat',
      'Date embauche',
      'Heures totales',
      'Heures normales',
      'Taux horaire base',
      'Salaire base',
      'Heures sup. 25%',
      'Montant HS 25%',
      'Heures sup. 50%',
      'Montant HS 50%',
      'Heures de nuit',
      'Prime nuit',
      'Salaire brut',
      'Charges salariales',
      'Salaire net',
    ];

    const rows = slips.map(slip => [
      slip.employee.lastName,
      slip.employee.firstName,
      slip.employee.socialSecurityNumber,
      slip.employee.position,
      slip.employee.department,
      slip.employee.contractType,
      format(new Date(slip.employee.startDate), 'dd/MM/yyyy'),
      slip.totalHours.toFixed(2),
      slip.regularHours.toFixed(2),
      slip.employee.hourlyRate.toFixed(2),
      slip.baseSalary.toFixed(2),
      slip.overtime25Hours.toFixed(2),
      slip.overtime25Pay.toFixed(2),
      slip.overtime50Hours.toFixed(2),
      slip.overtime50Pay.toFixed(2),
      slip.nightHours.toFixed(2),
      slip.nightBonus.toFixed(2),
      slip.grossSalary.toFixed(2),
      slip.socialCharges.toFixed(2),
      slip.netSalary.toFixed(2),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // Télécharger le CSV
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `bulletins_paie_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAllExcel = () => {
    generateExcel(generatedSlips);
  };

  const generateAllCSV = () => {
    generateCSV(generatedSlips);
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
          <i className="fas fa-file-invoice-dollar text-purple-500"></i>
          Fiches de paie - IDCC 1790
        </h1>
        <p className="text-gray-500 text-sm mt-1">Convention collective des espaces de loisirs, d'attractions et culturels</p>
      </div>

      {/* IDCC 1790 Rules Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Règles IDCC 1790 appliquées
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-purple-800">
          <div>
            <p className="font-medium">Durée légale :</p>
            <p>35h/semaine</p>
          </div>
          <div>
            <p className="font-medium">Heures supplémentaires :</p>
            <p>+25% (36-43h) / +50% (44h+)</p>
          </div>
          <div>
            <p className="font-medium">Travail de nuit (21h-6h) :</p>
            <p>+1€ brut/heure</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-purple-200 text-sm text-purple-700">
          <p className="font-medium mb-1">💡 Export comptable :</p>
          <p className="text-xs">Les exports Excel et CSV sont compatibles avec les logiciels comptables (Pennylane, Sage, etc.)</p>
          <ul className="text-xs mt-1 ml-4 list-disc">
            <li><strong>Excel</strong> : 3 onglets (Résumé, Détail, Export comptable avec écritures)</li>
            <li><strong>CSV</strong> : Format simplifié pour import rapide</li>
          </ul>
        </div>
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium rounded-xl shadow hover:shadow-lg transition-all"
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
            <div className="flex gap-2">
              <button
                onClick={generateAllExcel}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-xl shadow hover:shadow-lg transition-all"
              >
                <i className="fas fa-file-excel mr-2"></i>Export Excel
              </button>
              <button
                onClick={generateAllCSV}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-medium rounded-xl shadow hover:shadow-lg transition-all"
              >
                <i className="fas fa-file-csv mr-2"></i>Export CSV
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {generatedSlips.map((slip) => (
              <div key={slip.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {slip.employee.firstName[0]}{slip.employee.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {slip.employee.firstName} {slip.employee.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{slip.employee.position} • {slip.employee.department}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Total</p>
                      <p className="font-bold text-gray-800">{slip.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">HS 25%</p>
                      <p className="font-bold text-orange-600">{slip.overtime25Hours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">HS 50%</p>
                      <p className="font-bold text-red-600">{slip.overtime50Hours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Nuit</p>
                      <p className="font-bold text-purple-600">{slip.nightHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Brut</p>
                      <p className="font-bold text-gray-800">{slip.grossSalary.toFixed(0)}€</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Net</p>
                      <p className="font-bold text-green-600 text-lg">{slip.netSalary.toFixed(0)}€</p>
                    </div>
                  </div>


                </div>

                {/* Detail breakdown */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Heures normales</p>
                    <p className="font-semibold text-gray-700">
                      {slip.regularHours.toFixed(1)}h × {slip.employee.hourlyRate.toFixed(2)}€ = {slip.baseSalary.toFixed(2)}€
                    </p>
                  </div>
                  {slip.overtime25Hours > 0 && (
                    <div className="bg-orange-50 rounded-xl p-3">
                      <p className="text-xs text-orange-500 mb-1">Heures sup. 25%</p>
                      <p className="font-semibold text-orange-700">
                        {slip.overtime25Hours.toFixed(1)}h × {(slip.employee.hourlyRate * 1.25).toFixed(2)}€ = {slip.overtime25Pay.toFixed(2)}€
                      </p>
                    </div>
                  )}
                  {slip.overtime50Hours > 0 && (
                    <div className="bg-red-50 rounded-xl p-3">
                      <p className="text-xs text-red-500 mb-1">Heures sup. 50%</p>
                      <p className="font-semibold text-red-700">
                        {slip.overtime50Hours.toFixed(1)}h × {(slip.employee.hourlyRate * 1.50).toFixed(2)}€ = {slip.overtime50Pay.toFixed(2)}€
                      </p>
                    </div>
                  )}
                  {slip.nightHours > 0 && (
                    <div className="bg-purple-50 rounded-xl p-3">
                      <p className="text-xs text-purple-500 mb-1">Prime de nuit</p>
                      <p className="font-semibold text-purple-700">
                        {slip.nightHours.toFixed(1)}h × {IDCC_1790_RULES.nightWorkBonus.toFixed(2)}€ = {slip.nightBonus.toFixed(2)}€
                      </p>
                    </div>
                  )}
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
          <p className="text-gray-400 text-sm mt-1">pour générer les fiches de paie selon l'IDCC 1790</p>
        </div>
      )}
    </div>
  );
}
