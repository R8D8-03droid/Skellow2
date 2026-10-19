# Skellow

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Skellow aide les restaurateurs à organiser l’équipe, les services et la préparation de paie. Les anciennes données de démonstration restent des exemples locaux ; elles ne définissent pas le secteur ou les données d’un véritable établissement.

## Users

Un compte confirmé peut créer un ou plusieurs établissements ou en rejoindre un par invitation. Le propriétaire gère les accès. Les administrateurs gèrent les fiches salariés, le planning et la préparation de paie. Les salariés consultent leur propre fiche et leurs propres services.

## Capabilities and Constraints

React, TypeScript et Vite. Le mode Supabase utilise Auth et PostgreSQL, des appartenances propres à chaque établissement, des politiques d’accès en base, des écritures avec révision et un import explicite des données locales. Les fiches salariés et les comptes de connexion sont distincts. Une invitation d’accès est liée à une adresse e-mail confirmée ; son lien est partagé manuellement par le propriétaire et expire après sept jours. La connexion Google n’est proposée que si son fournisseur est activé dans Supabase. Sans configuration, la démonstration locale demeure disponible. La paie reste une estimation côté navigateur, sans bulletin certifié, envoi automatique ou synchronisation temps réel.

## Brand Commitments

L’utilisateur a demandé un design premium, clair et animé, inspiré par deux références visuelles, avec des commandes utilisables, un effet liquid glass mesuré et une interface française. Préserver la lisibilité, l’accessibilité et la réduction des animations à la demande.

## Evidence on Hand

Références : `.context/attachments/33eVuZ/réf sky2.jpg` et `.context/attachments/qFPsW2/réf sky.jpg` (noms réels avec accents décomposés). Le code et les migrations du dépôt font autorité pour le comportement.

## Product Principles

- Lire la semaine de travail d’un coup d’œil.
- Faire correspondre chaque commande visible à une action claire.
- Préserver les données et annoncer l’état réel d’une opération.
- Garder les établissements et leurs droits indépendants.
- Fonctionner au clavier, au toucher et avec des animations réduites.
