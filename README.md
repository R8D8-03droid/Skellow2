# Skellow

Skellow aide les restaurateurs à organiser les plannings, les fiches salariés et la préparation de paie. L’interface est en français, avec React, TypeScript et Vite.

## Démarrer

```sh
npm ci
npm run dev -- --port 3100
```

Sans configuration, l’application ouvre une démonstration locale dont les données restent dans le navigateur. Le mode connecté repose sur Supabase Auth et PostgreSQL : un compte confirmé peut créer un établissement, rejoindre un établissement par invitation et changer entre ses établissements accessibles. Le propriétaire gère les accès ; les administrateurs gèrent l’équipe et les services ; les salariés voient leur fiche et leur planning. Les droits sont vérifiés en base pour chaque établissement.

Pour préparer le backend, lire [BACKEND.md](BACKEND.md), puis renseigner `.env.local` depuis `.env.example`. Le site [GitHub Pages](https://r8d8-03droid.github.io/Skellow2/) est reconstruit automatiquement après les vérifications d’un push sur `main`. Son mode de données publié est contrôlé séparément : voir [DEPLOYMENT.md](DEPLOYMENT.md).

## Vérifier

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
```

Les tests SQL locaux utilisent PGlite ; les tests navigateur interceptent les réponses HTTP du SDK Supabase. La [recette SQL hébergée](supabase/tests/hosted-smoke.sql) contrôle en plus le projet distant dans une transaction annulée à la fin. Ces contrôles ne remplacent pas un cycle réel d’inscription et de connexion avant le passage du site publié en mode connecté.

La préparation de paie est une estimation calculée dans le navigateur, pas un bulletin certifié. L’import des anciennes données locales est volontaire et limité à l’établissement sélectionné.
