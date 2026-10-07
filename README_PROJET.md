# Hôtel Planning - Application de gestion du personnel

## Structure du projet

Voici la liste complète des fichiers à créer dans votre nouvelle conversation :

### Fichiers principaux

1. **index.html** (racine du projet)
   - Page HTML principale avec Font Awesome et configuration du thème

2. **src/types.ts**
   - Interfaces TypeScript : Employee, Shift, PaySlip, ViewType

3. **src/data.ts**
   - Données par défaut (employés et shifts)
   - Fonctions de chargement/sauvegarde localStorage

4. **src/App.tsx**
   - Composant principal avec routing et gestion d'état

### Composants (src/components/)

5. **Login.tsx**
   - Page de connexion avec authentification

6. **Sidebar.tsx**
   - Menu latéral de navigation

7. **Dashboard.tsx**
   - Tableau de bord avec statistiques

8. **Planning.tsx**
   - Planning hebdomadaire avec drag & drop
   - Gestion des shifts (ajout, modification, suppression, duplication)
   - Calcul des heures travaillées vs contrat

9. **EmployeeManagement.tsx**
   - Gestion des employés (CRUD complet)
   - Informations contractuelles complètes

10. **PaySlipGenerator.tsx**
    - Génération des fiches de paie
    - Export PDF avec jsPDF

## Packages npm requis

```bash
npm install date-fns jspdf jspdf-autotable @dnd-kit/core
```

## Fonctionnalités implémentées

✅ Système d'authentification (admin/employé)
✅ Planning hebdomadaire avec drag & drop
✅ Mode copie pour dupliquer les shifts
✅ Suppression avec confirmation
✅ Plusieurs shifts par jour
✅ Calcul automatique des heures et écarts contrat
✅ Gestion complète des employés
✅ Génération de fiches de paie en PDF
✅ Interface responsive (mobile/desktop)
✅ Stockage localStorage

## Comptes de démonstration

- **Admin** : admin@hotel.fr / admin123
- **Employé** : jean.martin@hotel.fr / jean123

## Instructions pour la nouvelle conversation

Dans votre nouvelle conversation Qwen Coder, vous pouvez dire :

"Je souhaite recréer mon application de planning pour hôtel-restaurant. Voici les fichiers que j'ai déjà créés :

1. [Coller le contenu de index.html]
2. [Coller le contenu de src/types.ts]
3. [Coller le contenu de src/data.ts]
4. [Coller le contenu de src/App.tsx]
5. [Coller le contenu de src/components/Login.tsx]
6. [Coller le contenu de src/components/Sidebar.tsx]
7. [Coller le contenu de src/components/Dashboard.tsx]
8. [Coller le contenu de src/components/Planning.tsx]
9. [Coller le contenu de src/components/EmployeeManagement.tsx]
10. [Coller le contenu de src/components/PaySlipGenerator.tsx]

Peux-tu recréer tous ces fichiers dans mon projet ?"

Les fichiers COMPONENT_*.tsx contiennent le code des composants pour faciliter la copie.
