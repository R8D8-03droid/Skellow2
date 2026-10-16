---
name: Skellow
description: Un espace de travail clair, minéral et tactile pour les équipes de nuit.
colors:
  primary: "#123c2d"
  primary-hover: "#1d513c"
  graphite: "#1e3027"
  muted: "#626f64"
  mineral: "#e7eae3"
  rail: "#f4f6f0"
  paper: "#ffffff"
  surface: "#f6f8f4"
  border: "#e0e7df"
  border-strong: "#cdd8cf"
  sage: "#326747"
  blue-wash: "#eaf0f8"
  blue-ink: "#466182"
  lilac-wash: "#eeebf7"
  lilac-ink: "#6a548b"
  amber-wash: "#faf1dd"
  amber-ink: "#7f632a"
  rose-wash: "#faeae7"
  rose-ink: "#8b534b"
  sage-wash: "#eaf1e6"
  sage-ink: "#4d6944"
typography:
  headline:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "clamp(26px, 2.2vw, 33px)"
    fontWeight: 480
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "16px"
    fontWeight: 560
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "12px"
    fontWeight: 520
    lineHeight: 1.4
rounded:
  badge: "5px"
  control: "8px"
  panel: "12px"
  frame: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#5c6559"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  badge:
    backgroundColor: "{colors.sage-wash}"
    textColor: "{colors.sage-ink}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
---

## Overview

**Creative North Star: "L’équipe, en harmonie."**

Skellow présente l’organisation d’une soirée comme un espace de travail calme : fond minéral, feuille blanche, navigation au vert forêt affirmé et informations rangées par personne. La précision des alignements et les couleurs de département rendent la semaine immédiatement lisible.

Les commandes ont des bords optiques doux et une réponse courte. Le verre accompagne les sélecteurs et les notifications flottantes. La donnée reste sur une surface opaque pour conserver son contraste.

**Key Characteristics:**
- Une feuille blanche dans un cadre minéral.
- Des couleurs pastel liées aux départements.
- Une typographie compacte et des horaires alignés.
- Un mouvement qui garde le lien entre les personnes, les dates et les actions.

## Colors

Le vert forêt `#123c2d` porte les titres, la navigation active, les commandes principales et les sélections. Les grandes touches de vert sont limitées à l’invitation de l’équipe et au premier indicateur de la vue d’ensemble. Le graphite vert porte le contenu ; les surfaces restent claires. Le texte secondaire utilise la couleur `muted`, vérifiée avec les fonds effectivement utilisés.

Les couples bleu, lilas, ambre, rose et sauge suivent les départements dans les avatars, les badges, les services et la frise horaire. La couleur accompagne toujours un nom ou un statut écrit.

**The Department Rule.** Conserver la même couleur pour un département sur toutes les vues ; utiliser son encre colorée sur son fond pastel.

## Typography

Geist Variable est livré localement par `@fontsource-variable/geist`. Son dessin compact garde les noms, horaires et commandes lisibles dans les tableaux. Les titres ont une graisse modérée ; les valeurs importantes utilisent la même famille avec des chiffres tabulaires.

Les titres de page suivent `headline`. Les libellés denses sont compris entre 10 et 12 px ; les champs de formulaire passent à 16 px sur téléphone. Le titre de connexion atteint 53 px sur grand écran. L’approche minimale est celle du token `headline`.

**The Reading Order Rule.** Un titre, une courte explication, puis les commandes ; les labels de navigation n’ajoutent pas un niveau de titre.

## Layout

Le cadre de bureau garde une marge extérieure de 12 px et une navigation de 224 px. La feuille de contenu occupe le reste de la fenêtre ; elle défile indépendamment de la barre supérieure. Les pages ont une largeur maximale de 1 580 px, avec 32 px de marge intérieure sur le bureau standard.

La grille de l’équipe utilise trois colonnes, puis deux, puis une. Le planning hebdomadaire conserve une colonne de personnes fixe et son propre défilement horizontal. Sous 580 px, il devient une liste par journée ; les personnes en service passent avant celles au repos.

À 800 px et moins, la navigation devient un tiroir avec fond inactif, focus contenu et fermeture par Échap. Les contrôles tactiles sont agrandis. La densité compacte reste une préférence explicite.

**The Local Scroll Rule.** Un tableau ou une frise peut défiler dans son cadre ; la page entière ne doit pas déborder horizontalement.

## Elevation & Depth

Les grands panneaux sont définis par une ligne douce. Les commandes ont une légère ombre de contact et un reflet intérieur. Les éléments flottants peuvent ajouter transparence, flou d’arrière-plan et saturation mesurée ; les valeurs exactes sont dans `src/index.css` et dans le sidecar.

**The Glass Rule.** Réserver le verre aux surfaces qui se superposent ou signalent une sélection ; garder les lignes de planning et les textes sur des fonds lisibles.

## Shapes

Les angles évoluent avec la taille : petits badges, commandes, panneaux, cadre principal. Les avatars sont circulaires ; les contrôles de saisie restent rectangulaires avec des angles doux. L’icône de marque et les pictogrammes Lucide utilisent une géométrie nette.

## Components

- **Boutons** : variantes principale, secondaire, discrète et destructive. Une icône accompagne le verbe ; les boutons à icône seule ont un nom accessible. Les états survol, focus, pression, désactivé et export en cours sont définis.
- **Sélecteurs segmentés** : une capsule vert forêt glisse sous la sélection dans un support translucide. La copie blanche suit un masque mesuré pendant le déplacement ; au repos, seul le libellé du bouton reste affiché. Chaque option expose `aria-pressed`.
- **Services** : couleur du département, horaires, rôle et durée ou présence. Sur bureau, glisser déplace le service ; cliquer permet aussi de modifier la personne et la date au clavier.
- **Membres** : identité, contrat, département et contact dans une fiche, avec un statut discret et sans répétition des libellés de métadonnées. L’archivage conserve l’historique ; les actions sensibles demandent une confirmation intégrée.
- **Fenêtres de saisie** : `dialog` natif, titre relié, Échap, focus contenu et erreurs explicites. Les champs restent dans une grille qui se réorganise sur téléphone.
- **Notifications** : confirmation verte ou erreur rose, texte concret, fermeture manuelle et disparition après 4,5 secondes.

**The Motion Rule.** Pression à 150 ms, sélections à 260 ms, réorganisation des membres à 240–280 ms, changement de date à 220 ms. La frise révèle les durées de gauche à droite en 400 ms, avec au plus 120 ms de décalage ; les barres de la semaine prennent leur hauteur en 460 ms, avec au plus 150 ms de décalage. Les fenêtres et notifications sortent en 140 ms après une fermeture à la souris. Échap et les commandes clavier sont immédiats. Les préférences système et utilisateur arrêtent aussi les animations programmatiques en cours. Aucun mouvement permanent.

## Do's and Don'ts

### Do
- Réutiliser les composants de `src/components/ui.tsx` et les couleurs de département.
- Donner un nom accessible à chaque commande à icône seule.
- Vérifier les textes, états vides, erreurs et focus à 320 px comme sur bureau.
- Afficher des comptes et états issus des données enregistrées.

### Don't
- Ne pas rendre l’information dépendante de la couleur seule.
- Ne pas placer les données de planning sur une surface transparente à contraste variable.
- Ne pas animer en boucle les listes ou les commandes répétées.
- Ne pas présenter une estimation de paie comme un bulletin certifié.

## Refinement — forêt et mouvement

L’identité validée est conservée : feuille blanche, cadre minéral, cartes de personnes et couleurs fonctionnelles des départements. La passe approfondit le vert et retire des cadres secondaires ; elle ne transforme pas l’outil en interface sombre.

La continuité est gérée dans `src/motion.ts` : animations natives du navigateur, nettoyage à la sortie de la vue et politique de mouvement commune. Les filtres déplacent les membres existants par leurs identifiants ; les dates avancent et reculent dans le sens attendu. Les données restent exactes pendant les transitions.
