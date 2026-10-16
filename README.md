# Skellow

Planning d’équipe, fiches salariés et préparation de paie. Interface française en React, TypeScript et Vite.

## Démarrer

```sh
npm ci
npm run dev -- --port 3100
```

Sans configuration, l’application utilise la démonstration locale. Les accès de démonstration sont proposés sur l’écran de connexion ; les données restent dans ce navigateur.

Le mode connecté utilise Supabase Auth et PostgreSQL pour partager les données et appliquer les droits administrateur/employé en base. Il nécessite un projet Supabase, la migration fournie et un premier compte administrateur. Suivre [BACKEND.md](BACKEND.md) avant de remplir `.env.local` à partir de `.env.example`.

La publication sur [GitHub Pages](https://r8d8-03droid.github.io/Skellow2/) est automatique après un push sur `main` et la réussite des tests. Le fonctionnement et les variables d’activation du backend sont décrits dans [DEPLOYMENT.md](DEPLOYMENT.md).

## Vérifier

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
```

Les tests de base utilisent PostgreSQL embarqué avec PGlite ; les tests navigateur utilisent le SDK Supabase avec des réponses HTTP simulées. Ils ne nécessitent aucun compte distant et ne constituent pas un test d’intégration sur un projet Supabase hébergé.

La préparation de paie reste un calcul estimatif exécuté dans le navigateur. Le détail du périmètre, de l’import local et de l’activation des accès figure dans [BACKEND.md](BACKEND.md).
