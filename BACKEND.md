# Backend Skellow — premier lot

Le dépôt contient le mode connecté et sa migration. Aucun projet Supabase hébergé n’a été configuré ou modifié pendant cette implémentation. Sans variables de connexion, l’application continue en démonstration locale.

## Périmètre

Un projet Supabase représente **un établissement**. Les comptes Supabase Auth sont distincts des fiches salariés. Les fiches, services, présences et absences sont stockés dans PostgreSQL ; les écrans existants passent par un dépôt de données asynchrone.

| Accès | Lecture | Écriture |
| --- | --- | --- |
| Administrateur actif et lié | Toutes les fiches et tous les services de l’établissement | Fiches et services, via une fonction contrôlée |
| Employé actif et lié | Sa propre fiche et ses propres services | Aucune écriture métier |
| Compte non lié ou salarié archivé | Aucune donnée métier | Aucune |
| Visiteur non connecté | Aucune donnée métier | Aucune |

Ces règles s’appliquent dans PostgreSQL, y compris aux appels directs à l’API. Le rôle provient de la fiche en base ; les métadonnées modifiables du compte Auth ne peuvent pas accorder de privilèges. Les écritures directes sur les tables sont refusées aux rôles de l’API navigateur.

## Activer un espace connecté

### 1. Préparer le projet et la base

Utiliser un projet Supabase dédié à cet établissement. La migration crée les tables `public.employees`, `public.shifts`, les règles RLS et les fonctions nécessaires. Elle conserve les identifiants texte des anciennes données locales.

Avec la CLI Supabase installée et authentifiée, depuis la racine du dépôt :

```sh
supabase link --project-ref VOTRE_REFERENCE_PROJET
supabase db push --dry-run
supabase db push
```

Vérifier le projet cible et les migrations annoncées avant le dernier appel. Sur une base contenant déjà des objets métier, examiner son schéma et sauvegarder ses données avant d’appliquer cette migration initiale. Elle ne remplace pas des tables existantes et ne doit pas être rejouée sur une base déjà initialisée. Le flux CLI et le suivi des versions sont décrits dans la [documentation des migrations Supabase](https://supabase.com/docs/guides/deployment/database-migrations).

Alternative pour une première installation : exécuter une seule fois le contenu de [`supabase/migrations/202610160001_workspace.sql`](supabase/migrations/202610160001_workspace.sql) dans le SQL Editor, avec le rôle opérateur `postgres`, dans une transaction `begin; … commit;`. Conserver la version appliquée. Une exécution manuelle ne renseigne pas l’historique de migration de la CLI : le réconcilier avant d’utiliser ensuite `db push`, sans rejouer le SQL.

Le fichier `supabase/config.toml` prépare uniquement la pile de développement locale : API sur `54321`, PostgreSQL 17 sur `54322`, inscription désactivée. Il ne configure pas les réglages Auth du projet hébergé.

### 2. Configurer les comptes

Dans les réglages Auth du projet hébergé, désactiver **Allow new users to sign up** et conserver la connexion par e-mail/mot de passe. Les comptes de ce lot sont créés par l’opérateur. Voir la [configuration générale Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

Dans Authentication → Users, créer manuellement le premier utilisateur avec une adresse vérifiée, un mot de passe et l’option de confirmation de l’adresse. Relever son UUID. Ce parcours n’exige pas d’envoyer une invitation depuis l’application.

Dans le SQL Editor, sous le rôle opérateur :

```sql
select private.bootstrap_admin('UUID_DU_COMPTE_AUTH', 'Prénom', 'Nom');
```

Cette fonction exige un compte dont l’adresse est confirmée et une table de salariés vide. Elle crée une fiche administrateur active et liée à ce compte. Les paramètres de contrat et de rémunération sont initialisés à des valeurs de départ ; compléter la fiche après connexion. La fonction ne permet pas de réinitialiser un établissement déjà utilisé.

### 3. Connecter l’interface

Créer `.env.local` à partir de `.env.example` :

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VOTRE_CLE_PUBLIQUE
```

Utiliser la clé **publishable** du projet. Une ancienne clé JWT `anon` est également acceptée dans cette variable. Les clés `service_role` et `sb_secret_…` n’appartiennent jamais à une variable `VITE_` ni au code livré au navigateur. Les clés publiques identifient l’application ; la session et les politiques RLS déterminent l’accès aux données. Voir les [clés API Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Redémarrer Vite après modification de `.env.local`. Pour une version déployée, renseigner les mêmes variables publiques dans l’environnement de compilation, puis reconstruire l’application : Vite les intègre au build.

Une configuration Supabase incomplète affiche une erreur explicite. Elle ne bascule pas silencieusement sur les données de démonstration. `VITE_DATA_MODE=demo` force la démonstration ; les deux environnements ne synchronisent pas automatiquement leurs données.

### 4. Activer les employés

1. Créer la fiche dans **Équipe** avec l’adresse e-mail de la personne, ou l’importer depuis les données locales.
2. Créer son compte Auth confirmé avec la même adresse dans le tableau de bord Supabase.
3. Relever les identifiants et exécuter la liaison en tant qu’opérateur :

```sql
select id, email, role, active from public.employees order by email;

select private.link_employee_account('IDENTIFIANT_DE_LA_FICHE', 'UUID_DU_COMPTE_AUTH');
```

La liaison exige une fiche active et des adresses identiques après normalisation. Le rôle métier vient de la fiche. La création d’une fiche seule ne crée pas de compte de connexion ; l’interface indique si l’accès est lié. Les fonctions de création initiale et de liaison sont privées et ne sont pas exécutables par les rôles API, même `service_role`.

L’archivage conserve l’historique et coupe les prochains accès à la base. Un écran déjà ouvert retire les données à son prochain rafraîchissement ; l’archivage ne détruit pas le compte Auth. Réactiver la fiche rétablit l’accès du compte encore lié. Une suppression de fiche est refusée tant que des services la référencent. Un administrateur ne peut pas se supprimer, s’archiver ou se retirer son propre rôle depuis l’application.

La modification de l’adresse d’une fiche déjà liée est réservée à l’opérateur pour garder Auth et la fiche cohérents. L’application ne fournit pas encore de parcours d’invitation, de changement d’adresse ou de réinitialisation de mot de passe. Ces opérations restent dans la gestion des comptes Supabase pour ce lot.

## Reprendre les données locales

Depuis une session administrateur connectée, ouvrir **Mon compte → Reprendre les données de cet appareil**. Le dialogue présente le nombre de fiches et services, les correspondances et une liste détaillée avant l’import.

- Les données viennent de `hotel_employees` et `hotel_shifts` du navigateur courant. Le mode connecté ne crée pas de données de démonstration.
- Une fiche déjà partagée est reconnue par son adresse e-mail normalisée. Elle reste intacte ; ses services locaux sont réattribués à son identifiant partagé.
- Les nouvelles fiches ont le rôle **Employé** et aucun compte Auth lié. Aucun mot de passe, identifiant Auth ou privilège administrateur local n’est transféré.
- Un service déjà présent et identique est ignoré. Les collisions d’identifiants, divergences de services, références manquantes et doublons locaux bloquent l’import.
- L’import est une transaction unique de 500 modifications maximum. Si une contrainte échoue, aucune des lignes du lot n’est ajoutée.
- Les services absents de la base et rattachés à un membre archivé bloquent l’import. Pour reprendre cet historique, préparer une copie locale avec la fiche active, importer, puis archiver la fiche partagée ; si elle existe déjà en base, la réactiver avant l’import. Les imports plus volumineux nécessitent une reprise opérateur préparée séparément.
- Les données sources restent sur l’appareil. Garder une copie avant toute préparation ou correction locale et comparer le résultat après import.

Les anciens mots de passe de démonstration ne deviennent jamais des mots de passe Supabase. Il faut provisionner les accès séparément.

## Garanties des écritures

`workspace_snapshot()` renvoie une lecture cohérente filtrée par les droits du compte. `apply_workspace_changes()` reçoit uniquement les fiches ou services à créer, modifier ou supprimer. L’application ne remplace plus les tableaux complets dans le mode connecté.

Chaque enregistrement porte une `revision`. Une création exige l’absence de l’identifiant ; une modification ou suppression exige la révision observée dans le formulaire. Si un autre administrateur a modifié la ligne, l’écriture est refusée et le brouillon reste ouvert. Fermer puis rouvrir la fiche permet de reprendre la version actuelle.

Les lots sont atomiques et un verrou de transaction sérialise les mutations de l’établissement, y compris les changements de droits effectués via les fonctions fournies. La base vérifie les champs autorisés, les valeurs, les références, les dates de contrat et les chevauchements de services. Les chevauchements sont refusés même après minuit ; deux services peuvent se toucher sans se chevaucher. Un membre archivé ne peut pas recevoir de nouvelle affectation, mais les notes et présences de ses services existants restent modifiables.

Une demande porte un UUID et laisse un reçu privé lié à son auteur et à l’empreinte de son contenu. Si la réponse réseau est perdue, réessayer le même contenu dans la session ouverte réutilise cet UUID et ne rejoue pas la mutation déjà enregistrée. Une demande différente ou un autre auteur ne peut pas réutiliser le reçu.

La correspondance entre contenu et UUID reste en mémoire dans l’onglet : après rechargement, changement d’identité ou déconnexion, vérifier les données avant de reprendre une opération dont le résultat est incertain. Les identifiants, adresses uniques et révisions continuent de protéger les lignes existantes. Les reçus n’ont pas encore de purge automatique ; définir une fenêtre de conservation compatible avec les reprises avant d’en supprimer.

## Sessions et rafraîchissement

Le SDK vérifie la session auprès d’Auth avant de charger les données. Les modifications confirmées mettent à jour l’écran et un rechargement relit la base. Un rafraîchissement est également déclenché toutes les 30 secondes quand la page est visible, au retour dans la fenêtre, au retour du réseau et avec le bouton d’actualisation. Ce lot n’utilise pas Supabase Realtime.

Les boutons de sauvegarde sont verrouillés pendant l’envoi ; une erreur conserve le formulaire et affiche un message. Les réponses tardives ne rétablissent pas les données d’une identité déjà déconnectée. Les changements de session entre onglets sont pris en compte. La déconnexion demandée concerne la session courante, pas toutes les connexions de la personne sur ses appareils.

Les données métier connectées restent en mémoire dans l’interface. La session Supabase persiste dans le stockage local du navigateur via le SDK. Les préférences d’interface et les anciennes données de démonstration peuvent également y rester. La démonstration conserve des identifiants locaux séparés des fiches dans `hotel_demo_credentials` ; elle n’est pas un système d’authentification adapté à des données réelles.

## Validation

```sh
npm ci
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
```

`npm test` exécute 22 tests : 12 sur la migration réelle dans PostgreSQL embarqué avec PGlite et `btree_gist`, et 10 sur la configuration, les données, l’import et le dépôt client. Ils vérifient notamment les droits directs, les contournements de rôle, les révisions, les reçus, le rollback, l’archivage et les conflits après minuit.

`npm run test:browser` exécute 10 scénarios dans Chromium avec le vrai SDK Supabase et des réponses HTTP interceptées : connexion, sauvegardes lentes ou refusées, réponse perdue, formulaire devenu obsolète, changement de rôle, expiration, révocation, déconnexion entre onglets, erreur de déconnexion et import. Le serveur de test utilise strictement `127.0.0.1:3101` avec des clés fictives. Pour utiliser un Chromium déjà installé :

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/absolu/vers/chromium npm run test:browser
```

Ces tests ne valident pas encore une installation Supabase hébergée. PGlite utilise une seule connexion : les conflits de révision sont testés, mais pas le timing de transactions concurrentes sur deux connexions. Après activation, vérifier sur le projet cible la persistance après reconnexion, la visibilité depuis deux sessions administrateur, les accès d’un employé, un conflit de modification simultanée et un chevauchement simultané. Utiliser des données de recette dédiées.

## Exploitation et suite

L’opérateur garde la responsabilité des sauvegardes et de leur restauration, de la création des comptes, des modifications d’identité et de la récupération d’un accès administrateur. En cas de perte d’accès, corriger ou relier la fiche existante depuis le SQL Editor avec les droits opérateur ; ne pas réexécuter la création initiale et ne pas réinitialiser la base. Les modifications SQL directes doivent aussi incrémenter `revision` et mettre à jour `updated_at` pour invalider les formulaires ouverts.

Les services utilisent la **date et l’heure civiles de l’établissement**, sans conversion par le fuseau du navigateur. Une fin antérieure au début appartient au lendemain. Les heures ambiguës lors d’un changement d’heure et le calcul de durée réellement écoulée nécessitent encore une politique de fuseau explicite.

La paie reste l’estimation et les exports navigateur existants. Le calcul de paie serveur, les bulletins certifiés, le multiétablissement, les invitations, les notifications, la journalisation détaillée des modifications, le temps réel et la pagination des historiques ne sont pas implémentés dans ce premier lot. Les reçus de reprise ne remplacent pas un journal d’audit métier.
