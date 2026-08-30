# FORMASKILLS TRAVEL OS — Reprise de projet (handoff)

Colle ce fichier (ou son contenu) au début d'un nouveau chat pour continuer
exactement là où on s'est arrêté.

## Contexte & objectif
Outil de gestion **100 % autonome** pour Formaskills Travel (séjours linguistiques /
mobilités Erasmus à Sète). Il doit remplacer Airtable + Make + les extensions
d'email-finder (Skrapp/Hunter/Snov) et un peu de n8n, **sans serveur, sans API,
sans abonnement, hors-ligne, pour toujours**. Priorités de l'utilisatrice :
- Rien ne doit se perdre (multi-PC, réinstallation, collègues).
- Interface **premium, claire, minimaliste, sans emoji**, tous les boutons fonctionnels.
- Le plus d'automatisation, de suivi, de synchronisation possible.
- Ne PAS copier-coller Airtable/Make : faire **mieux, plus clair, plus guidé**.
- Honnêteté totale sur ce qui est faisable hors-ligne ou non.

## Où c'est / comment ça tourne
- Dépôt GitHub : `himehitmann/FORMASKILLS-TRAVEL-MANUS`.
- **Une seule branche de travail** : `claude/email-finder-extensions-4954rr`
  (ne jamais en créer d'autres ; toujours mettre celle-ci à jour).
- Fichiers à la **racine** = l'extension Chrome (téléchargeable en ZIP et chargeable
  directement) :
  - `index.html` — page de l'app (HTML/CSS uniquement)
  - `app.js` — TOUTE la logique de l'app (≈2000+ lignes)
  - `scrape-core.js` — fonction `ftPageScrape()` injectée dans les pages (partagée app + popup)
  - `popup.html` / `popup.js` — la **bulle** de l'extension (façon Skrapp)
  - `manifest.json` (MV3, `default_popup: popup.html`), `background.js`, `icons/`
  - `README.md`, `CLAUDE.md`
- Fonctionne aussi en **double-clic sur index.html** (mode fichier), et comme
  **extension Chrome** (`chrome://extensions` → mode développeur → charger le dossier).

## Contraintes techniques CRITIQUES (à ne jamais casser)
- **CSP Manifest V3** : AUCUN script inline, AUCUN handler inline (`onclick=`…),
  pas d'`eval`. La délégation d'événements se fait via `data-call="fn('id')"`
  (parsé par `parseCall`, sans eval) et `data-act="nom"` (table `DELEGATED_ACTS`).
  Toute nouvelle UI doit utiliser ce système, jamais `onclick=` en HTML.
- Test de non-régression : servir les fichiers avec l'entête
  `Content-Security-Policy: script-src 'self'; object-src 'self'` et vérifier
  **zéro violation** (voir « Tests »).
- Stockage : `localStorage` (clé `FT_OS_DB_v1`) + miroir `chrome.storage.local`
  + fichier de synchro optionnel. `save()` est debouncé 120 ms (attention aux
  tests qui lisent localStorage trop vite).
- Pas d'emoji dans l'UI (glyphes standard `×`, `›` ok).

## CE QUI EST FAIT (fonctionnel + testé, 33/33 checks sous CSP)
- **App / tables (T1→T9 façon Airtable, en mieux)** : Tableau de bord avec
  **Assistant « À faire maintenant »** (actions priorisées à un clic), T1 Partenaires
  (kanban + tableau), T2 Projets + conformité **R1→R8**, T3 Participants, Finances
  (calcul de marge + lignes budgétaires + **Enveloppe Erasmus** à déduction auto),
  T6 Prestataires, T7 Tâches, Automatisations, Guide, Réglages.
- **Tables riches** : filtre par statut, **colonnes personnalisées**, **sélection
  multiple** (suppression + modification en masse), kanban drag&drop, export CSV.
- **Devis & Documents** : devis + **factures** (conversion 1 clic, numérotation
  D-/F-), **modèles** personnalisables, **fiche société** unique (pré-remplie avec
  les vraies infos légales du Drive), **mise en page** (logo, couleur, en-tête/pied)
  modifiable, **impression PDF**.
- **Chercheur de contacts** (8 onglets) : Scraper, Deviner par nom, Par domaine,
  En masse, Extraire d'une page, Profil/LinkedIn, Modèle, Vérifier, **Contacts**.
- **Bulle d'extension (façon Skrapp)** : clic sur l'icône → popup qui lit la page
  ACTIVE (LinkedIn/site), détecte les **profils LinkedIn d'une page de résultats**,
  sélection, **multi-pages**, enregistrement dans une **liste**, lien vers l'app.
- **Détection téléphone STRICTE** (`ftPhones` + inline dans scrape-core) : FR
  `0X XX XX XX XX` et international `+CC…`. Rejette années/SIRET/identifiants
  (fini les « 2026 2025 2024 » et « 000225039 »). Testé.
- **Vue Listes façon Skrapp** (onglet Contacts) : chips de listes, colonnes
  **Statut** (Valide/Catch-All/Perso/Invalide), **Séniorité**, **Fonction**
  (déduites hors-ligne par règles, sans IA payante), recherche, filtre statut,
  **pagination 25/page**, sélection multiple (déplacer vers liste / exporter / supprimer),
  import CSV, dédoublonnage.
- **Anti-perte de données** :
  - Sauvegarde export/import JSON + rappel hebdo dans l'Assistant.
  - Miroir `chrome.storage.local` (survit au rechargement de l'extension).
  - **Synchronisation fichier (File System Access API)** : Réglages → « Activer
    la synchro » → choisir un fichier à mettre dans le **dossier Google Drive** ;
    l'app y écrit à chaque changement ; Drive synchronise multi-PC/collègues.
    « Ouvrir un fichier existant » sur un autre PC. **Fusion union `mergeDB`**
    (aucun enregistrement perdu). Bannière « reconnecter » 1×/session.
  - Synchro live : `chrome.storage.onChanged` rafraîchit l'app quand la bulle
    enregistre des contacts.

## CE QUI N'EST PAS FAIT / À CONTINUER (par priorité)
1. ~~**Automatisations façon n8n (workflows multi-étapes)**~~ — **FAIT & TESTÉ**
   (29/29 checks sous CSP, 0 violation, 0 pageerror). Moteur multi-étapes dans
   `Automations` (app.js) : déclencheurs **contact ajouté, statut partenaire,
   projet créé, participant ajouté, devis accepté, facture en retard, tâche en
   retard, échéance de départ proche, planning quotidien** ; **conditions
   multiples ET/OU** (opérateurs contient/égal/différent/commence par/vide/non
   vide/supérieur/inférieur) ; **actions en séquence** : créer tâche (priorité +
   échéance), notifier, modifier un champ de la fiche, étiqueter, ajouter le
   contact à une liste, **préparer un email** (brouillon `mailto:` surfacé dans
   l'Assistant via « Écrire l'email »), **générer un document depuis un modèle**
   (pré-rempli société + ctx, surfacé via « Ouvrir le document »). Éditeur visuel
   (ajout/suppression/réordonnancement d'étapes, tout câblé en délégation, aucun
   handler inline), **modèles prêts à l'emploi**, résumé lisible dans la liste,
   **dé-doublonnage** des tâches auto (pas de doublon à chaque ouverture),
   **compatibilité ascendante** avec les anciennes règles (format simple converti
   à la volée par `Automations.norm`). n8n lui-même n'est PAS intégrable (serveur
   Node.js) — on en reproduit l'esprit, 100 % local. À valider par l'utilisatrice.
   Note honnête : les contacts arrivant via la bulle (chrome.storage.onChanged)
   ne redéclenchent pas encore `contact.created` (fusion de DB) — à brancher si
   souhaité.
2. **Validation réelle de la bulle LinkedIn** — testée seulement sur page LinkedIn
   *simulée* (pas de vrai compte dans l'environnement). Faire tester par
   l'utilisatrice ; ajuster les sélecteurs de `scrape-core.js` (`ftPageScrape`,
   section `profiles`) selon le vrai DOM LinkedIn si besoin.
3. **Export CSV automatique périodique** dans le dossier Drive (pour ouvrir les
   contacts directement dans Google Sheets) — proposé, en attente d'accord.
4. **Import des données Airtable existantes** (reprise en masse).
5. **T8 Registre documentaire** par dossier (archive centralisée des pièces + statut).
6. Générer les **documents participants pré-remplis** depuis le projet
   (nom + dates auto, zéro ressaisie) — l'ossature existe (modèles), à relier.

## Limites assumées (à répéter honnêtement à l'utilisatrice)
- Impossible hors-ligne : **révéler l'email caché** d'un profil LinkedIn (Skrapp
  utilise un serveur payant). L'outil récupère nom/poste/société et **devine**
  l'email quand le domaine est connu.
- Impossible hors-ligne : vraie **vérification SMTP** « boîte existe » (on fait
  syntaxe + heuristiques : jetable/générique/perso/pro).
- Vraie synchro cloud multi-utilisateurs temps réel = exigerait un serveur payant
  + OAuth (source de bugs) : on s'appuie sur le fichier + Google Drive à la place.

## Comment tester (obligatoire avant chaque commit)
- Node dispo. Playwright : `/opt/node22/lib/node_modules/playwright`, Chromium :
  `/opt/pw-browsers/chromium`.
- Syntaxe : `node --check app.js && node --check popup.js && node --check scrape-core.js`
  et `JSON.parse(manifest.json)`.
- Charger `index.html` via un petit serveur http qui ajoute l'entête
  `Content-Security-Policy: script-src 'self'; object-src 'self'` puis, avec
  Playwright, vérifier : nav peuplée, toutes les vues, actions déléguées,
  **zéro `pageerror`, zéro violation CSP** (le 404 favicon est normal).
- Scripts de test de référence dans le scratchpad de session : `e2e.mjs` (23 checks),
  `e2e2.mjs`, `lists.mjs`, `popup.mjs` (stub chrome), tests unitaires `ftPhones`
  et `ftPageScrape`.

## Règles de collaboration attendues
- Travailler UNIQUEMENT sur la branche `claude/email-finder-extensions-4954rr`,
  la mettre à jour (jamais de nouvelle branche), commits clairs, push à chaque étape.
- Toujours **tester dans le navigateur sous CSP** avant de dire « ça marche ».
- Rester **honnête** : distinguer FAIT/TESTÉ, À VALIDER par l'utilisatrice, PAS FAIT.
- UI premium, claire, sans emoji, tous les boutons câblés via délégation (CSP).
- Connecteurs Google Drive/Gamma souvent déconnectés dans la session : ne bloque rien
  (l'outil est autonome) ; demander une reconnexion côté claude.ai si besoin de relire le Drive.

## Prochaine action suggérée
Le point **1 (automatisations multi-étapes façon n8n)** est **livré et testé**.
Enchaîner sur le point **3 (export CSV auto vers Drive)** ou le point **6
(documents participants pré-remplis depuis le projet — l'action « générer un
document » du moteur d'automatisation fournit déjà l'ossature)**. Avant de coder
une nouvelle UI : relire cette liste, vérifier qu'aucun handler inline n'est
introduit, tester sous CSP.
