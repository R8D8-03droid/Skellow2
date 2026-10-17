# Publication Skellow

L’interface est publiée sur [GitHub Pages](https://r8d8-03droid.github.io/Skellow2/).

Chaque push sur `main` déclenche `.github/workflows/pages.yml` : installation depuis le lockfile, TypeScript, tests du dépôt et de la migration SQL, scénarios navigateur, compilation Vite et publication de `dist`. Les pull requests passent les mêmes vérifications sans publier. Un échec empêche la publication et laisse le site précédent en place.

Le build utilise `--base=/Skellow2/` pour charger scripts, styles et polices sous le chemin du dépôt. Le serveur de développement conserve sa racine habituelle. Cette configuration suit le [guide Vite pour GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages).

## Mode publié

La production présente actuellement la **démonstration locale** (`SKELLOW_DATA_MODE=demo`). Le backend est installé dans VICLOUIS et ses paramètres publics sont configurés dans GitHub. Le passage aux données partagées attend la création et la validation du premier compte personnel.

Ces **variables du dépôt GitHub** sont déjà renseignées dans Settings → Secrets and variables → Actions → Variables. Après la création du premier administrateur et la validation de la connexion décrites dans [BACKEND.md](BACKEND.md), passer seulement le mode à `supabase`, puis reconstruire :

| Variable | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://lazpzvenasxvianufnwg.supabase.co` (VICLOUIS) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique publishable de VICLOUIS, déjà renseignée |
| `SKELLOW_DATA_MODE` | `demo` actuellement ; `supabase` après validation du premier accès |

Ces deux informations de connexion sont publiques et incorporées au JavaScript. Aucun mot de passe de base, jeton opérateur ou clé `service_role`/`sb_secret_…` ne doit être utilisé ici. Les droits sur les données sont appliqués par Auth et RLS côté Supabase.

La compilation refuse une configuration connectée incomplète ou une clé secrète. La migration SQL et les comptes ne sont pas créés par le workflow du frontend.

Pour reconstruire après une modification des variables :

```sh
gh workflow run pages.yml --repo R8D8-03droid/Skellow2 --ref main
gh run list --repo R8D8-03droid/Skellow2 --workflow pages.yml --limit 5
```

La variable `SKELLOW_DATA_MODE=demo`, suivie d’une nouvelle compilation, rétablit explicitement la démonstration. Cela ne supprime ni ne migre les données de la base partagée.

## Vérifier ou revenir à une version

Consulter le job **Publish GitHub Pages** dans les [exécutions GitHub Actions](https://github.com/R8D8-03droid/Skellow2/actions/workflows/pages.yml). Son succès confirme la publication ; un push réussi seul ne la confirme pas. Vérifier ensuite la connexion et la navigation sur l’URL du site.

Pour annuler une modification de code publiée, créer un `git revert` du commit concerné sur `main`, puis pousser ce commit. Le même workflow vérifie et déploie la version corrigée. Éviter le force-push et conserver les migrations déjà appliquées à la base.
