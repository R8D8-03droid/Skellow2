# Backend Skellow — établissements et accès

Le projet Supabase choisi pour Skellow est **[VICLOUIS](https://supabase.com/dashboard/project/lazpzvenasxvianufnwg)** (`lazpzvenasxvianufnwg`, `us-east-1`). La migration initiale `202610160001_workspace.sql` y a déjà été exécutée avec le SQL Editor. **Ne pas la rejouer.** Son historique n’a pas été enregistré par la CLI : il faut le réconcilier avant d’utiliser `supabase db push`. La migration complémentaire `202610180001_restaurant_accounts.sql` introduit plusieurs établissements dans ce même projet.

Le site GitHub Pages reste en démonstration jusqu’à ce que la migration complémentaire, l’inscription publique et une connexion réelle aient été vérifiées. Ce mode est une variable de compilation, indépendante du schéma de la base.

## Parcours d’un restaurateur

1. La personne crée un compte par e-mail et mot de passe, puis confirme son adresse avec le lien reçu. La récupération de mot de passe utilise aussi un lien par e-mail. Si Google OAuth est configuré dans Supabase, le bouton Google apparaît et suit le même parcours de compte.
2. Une fois connectée, elle crée son établissement. Elle en devient propriétaire. Elle peut créer d’autres établissements ou ouvrir un établissement auquel elle appartient déjà.
3. Elle crée les fiches salariés dans **Équipe**. Dans **Accès**, elle choisit une fiche pour inviter un salarié, ou une adresse e-mail pour inviter un administrateur. L’application génère un lien valable sept jours ; **elle n’envoie pas d’e-mail d’invitation**. Le propriétaire transmet ce lien par le moyen de son choix.
4. La personne invitée s’inscrit ou se connecte avec **l’adresse exacte invitée et confirmée**, puis accepte le lien. Le propriétaire peut révoquer un lien en attente, changer un rôle ou suspendre/rétablir un accès. La base refuse de retirer le dernier propriétaire actif.

Un compte Auth n’est pas une fiche salarié. Le propriétaire et un administrateur peuvent avoir un accès sans fiche ; un salarié doit être rattaché à une fiche active dont l’e-mail correspond. Archiver cette fiche coupe son accès. Le lien d’invitation est un secret : ne pas le publier dans un canal ouvert. Il est retiré de la barre d’adresse quand l’application le reçoit, et seul son condensat est conservé en base.

## Isolation et écritures

Les tables `restaurants`, `memberships`, `employees` et `shifts` portent ou utilisent l’identifiant de l’établissement. Les clés et contraintes sur les fiches et services empêchent une affectation à un autre établissement. Les politiques RLS et les fonctions SQL contrôlent le compte confirmé, l’appartenance active et le rôle ; des métadonnées Auth modifiables ne suffisent pas à obtenir des droits. Les écritures directes des tables métier depuis le navigateur sont refusées : l’application passe par `workspace_snapshot` et `apply_workspace_changes`.

| Rôle | Lecture | Écriture |
| --- | --- | --- |
| Propriétaire | Toutes les fiches et tous les services de son établissement | Équipe, services, invitations et accès |
| Administrateur | Toutes les fiches et tous les services de son établissement | Équipe et services |
| Salarié lié à une fiche active | Sa fiche et ses services | Aucune écriture métier |
| Compte sans appartenance ou non confirmé | Aucune donnée métier | Aucune |

Les créations et modifications de fiches et services exigent des révisions cohérentes. Une collision conserve le brouillon et demande de relire la version récente. Une mutation contient uniquement ses lignes modifiées, s’exécute atomiquement et porte un identifiant de reprise. En cas de réponse réseau perdue, le même contenu peut être réessayé pendant la session de l’onglet sans rejouer une mutation déjà reçue. Après un rechargement ou un changement de compte, vérifier l’état de la base avant de répéter une opération incertaine. Un verrou par établissement sérialise les changements d’accès et les écritures métier.

L’application relit la base au chargement, après modification, toutes les 30 secondes lorsque la page est visible, au retour au premier plan et au retour du réseau. Elle n’utilise pas Supabase Realtime. Les données connectées restent en mémoire ; le SDK conserve la session Auth dans le navigateur. La démonstration et les préférences d’interface utilisent un stockage local séparé.

## Installation et configuration

Sur **VICLOUIS**, examiner l’état du schéma puis exécuter une seule fois [`supabase/migrations/202610180001_restaurant_accounts.sql`](supabase/migrations/202610180001_restaurant_accounts.sql) en tant qu’opérateur `postgres`, dans une transaction `begin; … commit;`. La migration reprend en place les fiches et services éventuels de l’ancienne installation à un établissement et convertit ses administrateurs liés en propriétaires. Ne pas utiliser `supabase db push` sur VICLOUIS avant d’avoir réconcilié l’historique de la migration initiale.

Pour un **nouveau projet**, appliquer les deux migrations dans l’ordre avec la CLI Supabase après avoir vérifié la cible et le plan de migration. La configuration locale dans `supabase/config.toml` autorise l’inscription par e-mail avec confirmation ; elle **ne configure pas** Auth sur le projet hébergé.

Sur le projet hébergé, activer l’inscription par e-mail, conserver la confirmation d’adresse, définir la **Site URL** sur `https://r8d8-03droid.github.io/Skellow2/` et autoriser cette URL dans les redirections Auth. Configurer SMTP et les modèles d’e-mails adaptés au volume réel avant une ouverture commerciale. Pour Google OAuth, configurer le fournisseur Google dans Supabase et ses URI de redirection chez Google ; le bouton de l’interface s’affiche seulement quand Supabase annonce ce fournisseur actif.

Pour lancer localement le mode connecté, copier `.env.example` vers `.env.local` et renseigner :

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://lazpzvenasxvianufnwg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VOTRE_CLE_PUBLIQUE
```

La clé `sb_publishable_…` (ou une ancienne clé `anon`) est destinée au navigateur. Ne jamais mettre `service_role`, `sb_secret_…`, un mot de passe ou une connexion PostgreSQL dans `VITE_`. Redémarrer Vite après une modification de `.env.local`. Une configuration incomplète échoue explicitement ; elle ne bascule pas silencieusement vers les données de démonstration.

## Reprendre les données de cet appareil

Depuis une session propriétaire ou administrateur, ouvrir **Mon compte → Reprendre les données de cet appareil** dans l’établissement souhaité. La boîte de dialogue présente les fiches et services, les correspondances et les collisions avant confirmation. Elle lit les anciennes clés `hotel_employees` et `hotel_shifts` du navigateur courant. Une fiche partagée existante est reconnue par son e-mail normalisé ; les nouvelles fiches entrent comme salariés sans compte Auth lié. Aucun mot de passe ou droit administrateur de démonstration n’est transféré. Les services identiques sont ignorés, les conflits bloquent le lot, et l’import de 500 modifications maximum est atomique. Les données locales restent sur l’appareil ; conserver une copie et vérifier le résultat avant de les modifier.

## Vérification

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Les tests unitaires contrôlent les migrations dans PGlite et les tests navigateur exercent les parcours avec le vrai SDK Supabase sur des réponses HTTP simulées. Pour vérifier **VICLOUIS** après les deux migrations, exécuter le fichier entier [`supabase/tests/hosted-smoke.sql`](supabase/tests/hosted-smoke.sql) en tant que `postgres`. Il crée des comptes et établissements synthétiques sous `example.invalid`, teste les limites d’accès et termine par `rollback`. Il fonctionne aussi si le projet contient déjà de vraies données ; ne jamais remplacer `rollback` par `commit`. Avec une connexion opérateur déjà configurée :

```sh
psql -v ON_ERROR_STOP=1 -f supabase/tests/hosted-smoke.sql
```

Le message `SaaS hosted smoke passed` n’apparaît que si les assertions réussissent. Contrôler ensuite que les comptes, établissements, fiches, services, invitations et reçus de recette n’ont pas été conservés. La recette SQL et les tests simulés ne vérifient pas la réception effective des e-mails ni un cycle réel d’inscription, de connexion, d’invitation et de retour après reconnexion. Réaliser ce parcours avant de passer la publication en mode connecté.

## Exploitation et limites

La paie reste une estimation et les exports restent ceux du navigateur. Les changements d’adresse d’un compte lié, la récupération d’un établissement sans propriétaire, la restauration des sauvegardes et l’enquête sur les modifications SQL relèvent encore d’un opérateur. Les reçus d’écriture ne sont pas un journal d’audit métier et n’ont pas de purge automatique. Les services utilisent les dates et heures civiles de l’établissement sans politique explicite pour les heures ambiguës du changement d’heure. Le calcul de paie serveur, les bulletins certifiés, les notifications automatiques, le temps réel et la pagination des historiques ne sont pas encore implémentés.
