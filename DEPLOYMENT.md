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
