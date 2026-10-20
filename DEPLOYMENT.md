# Publication Skellow

L’interface est publiée sur [GitHub Pages](https://r8d8-03droid.github.io/Skellow2/). Chaque push sur `main` lance [`.github/workflows/pages.yml`](.github/workflows/pages.yml) : installation depuis le lockfile, contrôle TypeScript, tests SQL locaux, scénarios navigateur, compilation Vite et déploiement de `dist`. Les pull requests vérifient sans publier. Un échec empêche la nouvelle publication.

Le build utilise `--base=/Skellow2/` pour charger ses ressources depuis le chemin du dépôt. La migration SQL, les réglages Supabase Auth et les comptes ne sont pas créés par le workflow GitHub Pages.

## Mode publié

La publication est actuellement en **démonstration locale** avec `SKELLOW_DATA_MODE=demo`. Les deux migrations sont appliquées sur VICLOUIS, la recette hébergée a réussi et l’inscription par e-mail avec confirmation est active. Le passage en mode connecté attend la vérification réelle du parcours compte confirmé → création d’établissement → invitation → acceptation → accès salarié. Voir [BACKEND.md](BACKEND.md).

Les variables suivantes sont configurées dans le dépôt GitHub sous **Settings → Secrets and variables → Actions → Variables** :

| Variable | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://lazpzvenasxvianufnwg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique publishable de VICLOUIS |
| `SKELLOW_DATA_MODE` | `demo` actuellement ; `supabase` après la recette réelle |

L’URL et la clé publishable sont intégrées au JavaScript livré. Les secrets d’opérateur, les mots de passe PostgreSQL et les clés `service_role` ou `sb_secret_…` ne doivent jamais figurer dans une variable `VITE_`. Les sessions Auth et RLS décident des accès. Le build refuse le mode connecté si une variable manque ou si une clé secrète est fournie.

Après un changement de variable, reconstruire explicitement :

```sh
gh workflow run pages.yml --repo R8D8-03droid/Skellow2 --ref main
gh run list --repo R8D8-03droid/Skellow2 --workflow pages.yml --limit 5
```

Revenir à `SKELLOW_DATA_MODE=demo` et reconstruire rétablit la démonstration sans effacer la base. Pour annuler un changement de code publié, pousser un `git revert` sur `main` : le workflow testera et publiera ce nouvel état. Éviter le force-push et ne pas annuler une migration déjà appliquée en effaçant des tables.

Le succès du job **Publish GitHub Pages**, suivi d’une ouverture du site, confirme la publication. Un push accepté seul ne la confirme pas.

## Préparation Vercel

Le projet Vercel [`victor-1844s-projects/skellow2`](https://vercel.com/victor-1844s-projects/skellow2) appartient à l’espace personnel choisi pour Skellow2. Le fichier [`vercel.json`](vercel.json) configure le build Vite à la racine et la réécriture des URLs vers la SPA. L’authentification Vercel protège **tous** les déploiements, y compris l’alias de production. `VITE_DATA_MODE=demo` est fixé pour Production et Preview : le site Vercel ne se connecte pas encore à VICLOUIS.

Le premier déploiement CLI d’un projet neuf est classé automatiquement en Production par Vercel. Cet alias est une démonstration privée ; **GitHub Pages reste l’adresse publique actuelle**. Pour produire une prévisualisation privée depuis un checkout lié :

```sh
vercel deploy --yes --no-wait --scope victor-1844s-projects
vercel inspect <URL_DU_DEPLOIEMENT> --scope victor-1844s-projects
```

La connexion Git automatique n’est pas encore active. Le dépôt `R8D8-03droid/Skellow2` appartient à un **compte GitHub personnel** dont la session GitHub actuelle n’est que collaboratrice ; [Vercel exige que le propriétaire de ce dépôt personnel établisse la connexion Git](https://vercel.com/docs/git/vercel-for-github#missing-git-repository). Aucun token Vercel n’a été confié aux Actions GitHub. Après l’autorisation du propriétaire, connecter ce dépôt au projet Vercel existant, avec `main` comme branche de production, puis vérifier un push de prévisualisation avant de remplacer GitHub Pages.

Avant le passage en SaaS connecté : valider le parcours réel décrit dans [BACKEND.md](BACKEND.md), configurer dans Vercel les deux variables publiques Supabase et `VITE_DATA_MODE=supabase`, puis ajouter l’URL Vercel exacte aux redirections Supabase Auth. Le plan Vercel Hobby sert ici à la préparation interne ; [l’usage commercial exige Pro ou Enterprise](https://vercel.com/docs/limits/fair-use-guidelines).
