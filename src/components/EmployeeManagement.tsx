import { useState } from 'react';
import { Employee } from '../types';
import { generateId } from '../data';
import { format } from 'date-fns';

interface EmployeeManagementProps {
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
}

export default function EmployeeManagement({ employees, onUpdateEmployees }: EmployeeManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');

  const departments = [...new Set(employees.map((e) => e.department))];

  const filteredEmployees = employees.filter((e) => {
    const matchSearch = `${e.firstName} ${e.lastName} ${e.email} ${e.position}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchDept = filterDepartment === 'all' || e.department === filterDepartment;
    return matchSearch && matchDept;
  });

  const handleSave = (employee: Employee) => {
    const existing = employees.findIndex((e) => e.id === employee.id);
    if (existing >= 0) {
      const updated = [...employees];
      updated[existing] = employee;
      onUpdateEmployees(updated);
    } else {
      onUpdateEmployees([...employees, { ...employee, id: generateId() }]);
    }
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) {
      onUpdateEmployees(employees.filter((e) => e.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    const updated = employees.map((e) =>
      e.id === id ? { ...e, active: !e.active } : e
    );
    onUpdateEmployees(updated);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-users text-purple-500"></i>
            Gestion des employés
          </h1>
          <p className="text-gray-500 text-sm mt-1">{employees.filter(e => e.active).length} employés actifs</p>
        </div>
        <button
          onClick={() => { setEditingEmployee(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl shadow hover:shadow-lg transition-all"
        >
          <i className="fas fa-user-plus mr-2"></i>Nouvel employé
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Rechercher un employé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">Tous les départements</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all ${
              !employee.active ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold">
                  {employee.firstName[0]}{employee.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <p className="text-sm text-gray-500">{employee.position}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                employee.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {employee.active ? 'Actif' : 'Inactif'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <i className="fas fa-building w-4 text-gray-400"></i>
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-file-contract w-4 text-gray-400"></i>
                <span>{employee.contractType} • {employee.hourlyRate}€/h</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-envelope w-4 text-gray-400"></i>
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-phone w-4 text-gray-400"></i>
                <span>{employee.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-calendar w-4 text-gray-400"></i>
                <span>Depuis le {format(new Date(employee.startDate), 'dd/MM/yyyy')}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => { setEditingEmployee(employee); setShowForm(true); }}
                className="flex-1 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors font-medium"
              >
                <i className="fas fa-edit mr-1"></i>Modifier
              </button>
              <button
                onClick={() => handleToggleActive(employee.id)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors font-medium"
              >
                <i className={`fas ${employee.active ? 'fa-user-slash' : 'fa-user-check'} mr-1`}></i>
                {employee.active ? 'Désactiver' : 'Activer'}
              </button>
              <button
                onClick={() => handleDelete(employee.id)}
                className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <EmployeeFormModal
          employee={editingEmployee}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingEmployee(null); }}
        />
      )}
    </div>
  );
}

interface EmployeeFormModalProps {
  employee: Employee | null;
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

function EmployeeFormModal({ employee, onSave, onClose }: EmployeeFormModalProps) {
  const [form, setForm] = useState<Partial<Employee>>(
    employee || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: 'Salle',
      contractType: 'CDI',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      hourlyRate: 11.5,
      monthlyHours: 151.67,
      socialSecurityNumber: '',
      address: '',
      postalCode: '',
      city: '',
      bankRIB: '',
      password: '',
      role: 'employee',
      active: true,
    }
  );

  const handleChange = (field: keyof Employee, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form as Employee);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800">
            {employee ? 'Modifier l\'employé' : 'Nouvel employé'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  value={form.firstName || ''}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.lastName || ''}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input
                  type="tel"
                  value={form.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Sécurité Sociale</label>
                <input
                  type="text"
                  value={form.socialSecurityNumber || ''}
                  onChange={(e) => handleChange('socialSecurityNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  placeholder="X XX XX XX XXX XXX XX"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Adresse</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={form.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                <input
                  type="text"
                  value={form.postalCode || ''}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  type="text"
                  value={form.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contrat</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poste *</label>
                <input
                  type="text"
                  value={form.position || ''}
                  onChange={(e) => handleChange('position', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                <select
                  value={form.department || 'Bar'}
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Bar">Bar</option>
                  <option value="Sécurité">Sécurité</option>
                  <option value="Accueil/Caisse">Accueil/Caisse</option>
                  <option value="Vestiaire">Vestiaire</option>
                  <option value="DJ/Animation">DJ/Animation</option>
                  <option value="Direction">Direction</option>
                  <option value="Ménage/Entretien">Ménage/Entretien</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat *</label>
                <select
                  value={form.contractType || 'CDI'}
                  onChange={(e) => handleChange('contractType', e.target.value as Employee['contractType'])}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="Alternance">Alternance</option>
                  <option value="Stage">Stage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'embauche *</label>
                <input
                  type="date"
                  value={form.startDate || ''}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin (si CDD)</label>
                <input
                  type="date"
                  value={form.endDate || ''}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taux horaire (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.hourlyRate || ''}
                  onChange={(e) => handleChange('hourlyRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heures mensuelles</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.monthlyHours || 151.67}
                  onChange={(e) => handleChange('monthlyHours', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Bank & Access */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Paiement & Accès</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">RIB / IBAN</label>
                <input
                  type="text"
                  value={form.bankRIB || ''}
                  onChange={(e) => handleChange('bankRIB', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input
                  type="text"
                  value={form.password || ''}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required={!employee}
                  placeholder={employee ? 'Laisser vide pour ne pas changer' : ''}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select
                  value={form.role || 'employee'}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                >
                  <option value="employee">Employé</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              {employee ? 'Mettre à jour' : 'Créer l\'employé'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
