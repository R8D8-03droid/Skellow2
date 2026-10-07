// Convention Collective IDCC 1790 - Espaces de loisirs, d'attractions et culturels
// Adaptée pour une boîte de nuit

export const IDCC_1790_RULES = {
  // Durée du travail
  weeklyLegalHours: 35, // Durée légale hebdomadaire
  monthlyLegalHours: 151.67, // Durée légale mensuelle (35h × 52/12)
  annualLegalHours: 1607, // Durée légale annuelle
  
  // Heures supplémentaires
  overtimeThreshold: 35, // Seuil de déclenchement des heures supplémentaires
  overtimeRates: [
    { from: 36, to: 43, rate: 0.25 }, // 25% de majoration
    { from: 44, to: Infinity, rate: 0.50 }, // 50% de majoration
  ],
  
  // Travail de nuit (définition légale : 21h-6h)
  nightWorkStart: 21, // 21h
  nightWorkEnd: 6, // 6h
  nightWorkBonus: 1.0, // Majoration de 1€ brut par heure de nuit
  nightWorkMinHours: 6, // Minimum 6 heures de nuit pour bénéficier de la majoration
  
  // Repos
  dailyRestHours: 11, // Repos quotidien minimum
  weeklyRestHours: 35, // Repos hebdomadaire minimum (24h + 11h repos quotidien)
  
  // Jours fériés
  publicHolidays: [
    '01-01', // Jour de l'an
    '05-01', // Fête du travail
    '05-08', // Victoire 1945
    '07-14', // Fête nationale
    '08-15', // Assomption
    '11-01', // Toussaint
    '11-11', // Armistice
    '12-25', // Noël
  ],
  
  // Départements typiques d'une boîte de nuit
  departments: [
    'Bar',
    'Sécurité',
    'Accueil/Caisse',
    'Vestiaire',
    'DJ/Animation',
    'Direction',
    'Ménage/Entretien',
  ],
  
  // Postes typiques
  positions: {
    'Bar': ['Barman/Barmaid', 'Chef barman', 'Serveur/Serveuse'],
    'Sécurité': ['Agent de sécurité', 'Chef de la sécurité', 'Videur'],
    'Accueil/Caisse': ['Hôte/Hôtesse d\'accueil', 'Caissier/Caissière'],
    'Vestiaire': ['Préposé au vestiaire'],
    'DJ/Animation': ['DJ', 'Animateur/Animatrice', 'Danseur/Danseuse'],
    'Direction': ['Directeur/Directrice', 'Responsable de salle', 'Gérant'],
    'Ménage/Entretien': ['Agent d\'entretien', 'Femme/Valet de chambre'],
  },
};

// Fonction pour calculer les heures supplémentaires selon l'IDCC 1790
export function calculateOvertime(weeklyHours: number): { regular: number; overtime25: number; overtime50: number } {
  const regular = Math.min(weeklyHours, IDCC_1790_RULES.weeklyLegalHours);
  let overtime25 = 0;
  let overtime50 = 0;
  
  if (weeklyHours > 35) {
    // Heures de 36 à 43 : majoration 25%
    overtime25 = Math.min(weeklyHours - 35, 8); // 8 heures max à 25%
    
    // Heures au-delà de 43 : majoration 50%
    if (weeklyHours > 43) {
      overtime50 = weeklyHours - 43;
    }
  }
  
  return { regular, overtime25, overtime50 };
}

// Fonction pour calculer les heures de nuit
export function calculateNightHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Gestion du passage à minuit
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  const nightStartMinutes = IDCC_1790_RULES.nightWorkStart * 60; // 21h = 1260 minutes
  const nightEndMinutes = IDCC_1790_RULES.nightWorkEnd * 60 + 24 * 60; // 6h du lendemain = 360 + 1440 = 1800 minutes
  
  let nightMinutes = 0;
  
  // Calcul des heures de nuit
  for (let minute = startMinutes; minute < endMinutes; minute++) {
    const currentHour = Math.floor(minute / 60) % 24;
    if (currentHour >= IDCC_1790_RULES.nightWorkStart || currentHour < IDCC_1790_RULES.nightWorkEnd) {
      nightMinutes++;
    }
  }
  
  return nightMinutes / 60; // Retour en heures
}

// Fonction pour vérifier si un shift est un shift de nuit
export function isNightShift(startTime: string, endTime: string): boolean {
  const [startH] = startTime.split(':').map(Number);
  const [endH] = endTime.split(':').map(Number);
  
  // Un shift est considéré comme "de nuit" s'il commence ou se termine pendant la période de nuit
  return (startH >= IDCC_1790_RULES.nightWorkStart || startH < IDCC_1790_RULES.nightWorkEnd) ||
         (endH >= IDCC_1790_RULES.nightWorkStart || endH < IDCC_1790_RULES.nightWorkEnd);
}
