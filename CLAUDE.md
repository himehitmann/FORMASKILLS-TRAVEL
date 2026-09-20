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
- **Capture de leads « façon Skrapp » sur pages de recherche (SERP), Google Maps
  et LinkedIn, multi-pages** — audit + refonte (24/24 checks sous CSP sur fixtures
  Google/Maps réelles, servies sous le vrai hostname `www.google.com` par
  interception réseau) :
  - `scrape-core.js` **extraction SERP** (`results[]` + `isSerp`) : sur une page
    de résultats Google / Bing / DuckDuckGo / Ecosia / Qwant, chaque résultat
    organique devient un **prospect** = nom d'entité + **site** + **domaine**
    (réutilisable par « Deviner l'email »). Filtre le bruit (réseaux sociaux,
    vidéos, liens Google internes/connexion/cache), **1 entrée par domaine**.
    Réponse au retour « la recherche Google ne donnait que des numéros » : on
    récupère désormais la **liste des entreprises + sites** directement depuis la
    page de recherche, sans même visiter chaque site.
  - `scrape-core.js` **détection Google Maps renforcée** : sélecteurs multiples
    (`role=article`, `/maps/place/`, `a.hfpxzc`, `.Nv2PK`, `.qBF1Pd`,
    `.fontHeadlineSmall`) → nom + téléphone (normalisé `+33`→`0X`) + site +
    adresse. Best-effort (classes Google changeantes), à valider sur le vrai DOM.
  - `Scraper.mergeResults` (app) : SERP → lignes CRM dédupliquées par domaine ;
    intégré à `scrapeRows` (fusion profils LinkedIn + SERP + fiches Maps + emails)
    et à `crawl`.
  - **« Récupérer toutes les pages de résultats »** (case dans Recherche web,
    `opts.allPages`) : `Scraper.crawl` enchaîne les pages Google (`&start=`)
    **jusqu'à épuisement** (page sans nouveau résultat) — borné par un plafond de
    sécurité (20) + la limite quotidienne. Champ « pages » monté à 20.
  - **1 clic depuis un onglet Google Maps ouvert** : `Scraper.harvestTab` fait
    **défiler le volet** (`ftScrollFeed`) plusieurs fois pour charger toutes les
    fiches puis scrape — bouton « Tout charger + récupérer » sur les onglets Maps
    de la liste « Onglet actif ».
  - **Bulle (popup) alignée** : `buildRows` prend les résultats SERP ; `scan`
    gère le **multi-pages Google** (`&start=`, arrêt auto quand plus rien) en plus
    de LinkedIn, et **fait défiler Google Maps** avant extraction. Sélecteur de
    pages affiché aussi sur Google.
  - Honnête : validation sur le **vrai DOM** Google/Maps/LinkedIn à faire par
    l'utilisatrice dans l'extension installée (les sélecteurs Google changent) ;
    aucune falsification d'empreinte ni proxy — cadence polie + quota inchangés.
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
- **Cadence polie du scraper** (`Scraper.crawl`, réglable dans Réglages) : délai
  aléatoire min/max entre visites + **limite quotidienne** (compteur `scrapeCount`
  remis à zéro chaque jour). But : ne pas marteler les sites (moins de blocages)
  en restant honnête — **aucune falsification d'empreinte, aucun proxy** (à
  l'inverse de Multilogin/Dolphin Anty, hors périmètre et impossibles hors-ligne).
- **Multi-expéditeurs (outreach)** : `DB.settings.senders` + `defaultSender`,
  gérés dans Réglages (nom, email, **signature**). Les brouillons d'email
  (automatisations + campagnes) utilisent l'expéditeur choisi et **ajoutent sa
  signature** (`ftEmailDraft`). Honnête : `mailto:` ne force pas le compte d'envoi
  (c'est le client mail qui décide) — on prépare le message prêt à partir.
- **Prospection consolidée (LinkedIn / web / pages de recherche)** — audit +
  fiabilisation complète (23/23 checks sous CSP sur page fixture réelle) :
  - `scrape-core.js` : **filtre anti-bruit des emails** (sentry, wixpress,
    example.com, pixels `@2x.png`, hash/identifiants) + **détection société**
    (`og:site_name` / `application-name` / `<title>` nettoyé). Détection
    téléphone stricte inchangée (FR + international, rejette années/SIRET).
  - **Parité bulle ↔ app** : le scraping d'un onglet LinkedIn *depuis l'app*
    (`scrapeRows`) liste désormais les **profils d'une page de résultats** et
    garde le **nom seul** d'une fiche profil (avant : ignorés, « aucun contact »).
    Import (`importScraped`) conserve les profils sans email, déduit `source`
    (linkedin/scraper), pose l'étape « À contacter », déclenche `contact.created`.
  - **Dé-obfuscation des emails** (`EmailFinder.deobfuscate` + inline dans
    `ftPageScrape`) : reconstruit les emails masqués — `nom [at] boite [point] fr`,
    `nom(at)boite.fr`, entités HTML `&#64;`/`&#46;`, `＠`, ` arobase `/` point `,
    `@` espacé — pour récupérer les emails que les sites cachent aux robots.
    Conservateur (ne transforme pas la prose « … at … »). Testé.
  - **Exploration profonde d'un site** (case « Explorer /contact, /mentions-
    légales… » dans Recherche web) : `Scraper.contactSubLinks` suit les pages
    internes riches en emails (contact, mentions légales, équipe, à-propos) du
    même domaine — beaucoup plus d'emails, dans la limite de cadence/quotidien.
  - **Fiches entreprise Google Maps / annuaires** (`ftPageScrape.businesses`) :
    détecte les cartes de résultats (Maps `role="article"` + `/maps/place/`, ou
    annuaires type PagesJaunes) et en extrait **nom + téléphone + site web +
    adresse**. Idéal pour la prospection **locale** (CFA, écoles, entreprises
    autour de Sète). Le site web devient le **domaine** du contact → réutilisable
    par « Deviner l'email ». Surfacé dans l'app ET la bulle, importable. Best-
    effort, à valider sur le vrai DOM Maps (classes Google changeantes).
  - **Recherche web multi-sources** (onglet Scraper → « Recherche web ») : source
    au choix **Google (sites web)**, **Google Maps (entreprises locales)** ou
    DuckDuckGo. Le mode **Maps** ouvre `/maps/search/…`, **fait défiler** le volet
    (`ftScrollFeed`) pour charger les fiches, puis extrait les entreprises
    (`Scraper.mergeBusinesses`). Les fiches entreprise sont aussi récupérées sur
    les pages visitées en mode Google/DDG. Toujours borné par cadence + quota.
  - **Normalisation FR des téléphones** : `+33 X …` est converti en `0X XX XX XX
    XX` (format homogène, dédup entre lien `tel:` et texte visible).
  - **Suivi de prospection** dans l'onglet Contacts : colonne **Étape**
    (À contacter / Contacté / Relancé / En discussion / Gagné / Perdu) éditable
    en ligne, **filtre par étape**, **source + date** sous le nom, action
    **« Email »** en un clic (brouillon `mailto:` + signature de l'expéditeur par
    défaut, passe l'étape à « Contacté » et date le contact). Export CSV enrichi
    (étape, source, sourceUrl, date). Nudge Assistant « X contacts à contacter ».
  - **Nature du contact** (`inferCategory` + `catOf`, `CONTACT_CATEGORIES`) :
    chaque contact a une **catégorie** (École / CFA, Restaurant, Hôtel /
    Hébergement, Transport, Financeur / OPCO, Institution / Mairie, Prestataire,
    Entreprise…), déduite du nom/service/domaine, **modifiable en ligne** (colonne
    Nature). Filtre par nature + bouton **« Trier par nature »** qui range les
    contacts affichés dans des **listes = leur nature** en un clic (toutes les
    écoles ensemble, tous les restaurants ensemble…). Colonne **Site** cliquable
    dans le tableau Contacts et dans les résultats de scraping.
- **Modèles d'email réutilisables** (`DB.emailTemplates`, gérés dans Réglages) :
  objet + message + **Cc/Cci** + **pièce jointe** optionnelle (un modèle de
  document, généré en PDF à joindre). Variables `{name}`/`{company}`/`{email}`.
  Utilisés par l'action **« Email »** d'un contact (sélecteur de modèle,
  **destinataires multiples**, PJ ouverte en PDF) et par les campagnes. Honnête :
  `mailto:` **n'attache pas** de fichier — l'outil ouvre le PDF, l'utilisatrice le
  glisse dans l'email (`ftEmailDraft` gère to multiples + cc + bcc ; `ftPrintDoc`
  génère la PJ).
  - **Import intelligent de sheets** (bouton « Importer / coller » de l'onglet
    Contacts, `openImport` / `parseTable` / `detectMapping` / `smartImport`) :
    coller directement depuis **Excel / Google Sheets** (TSV) ou un **CSV** ;
    détection auto du délimiteur (tab/;/,), des **en-têtes**, du **mapping des
    colonnes** (email, prénom, nom, société, téléphone, ville, pays, site,
    fonction) et de la **colonne email par scan** si pas d'en-tête. Aperçu
    (nb lignes / avec email / colonnes reconnues) puis import dans une **liste**
    nommée, dédoublonné, étape « À contacter », nature déduite.
  - **Envoi groupé / prospection prête à l'emploi** (`openBulkEmail` +
    `createContactEmailDraft`) : sélection multiple → **« Email groupé »** →
    choisir un **modèle** → un **brouillon par contact ayant un email** est
    préparé (surfacé dans « À faire maintenant »). **Suivi d'envoi** : envoyer
    un brouillon (`writeAutoEmail`) ou `markDraftSent` fait passer le contact à
    **Contacté** (puis Relancé), marque le brouillon **Fait** et il disparaît de
    l'assistant. Les brouillons portent un `contactId`. **Campagnes** : affichage
    de la **progression « X/Y envoyés · terminé »**. « Une fois tout envoyé, le
    statut change » = réalisé, honnêtement (mailto n'envoie pas seul, mais
    l'action d'envoi met à jour le statut et la progression).
  - **Envoi RÉEL via API Gmail (optionnel)** — `gmailConnect`/`gmailSend`/
    `buildRawEmail`, permission manifest `identity`, `DB.settings.gmail`. OAuth
    (scope **`gmail.send`** uniquement, révocable) via `chrome.identity.
    launchWebAuthFlow` — l'utilisatrice colle un **ID client OAuth Google**
    (créé une fois dans Google Cloud ; URI de redirection = `getRedirectURL()`
    affichée dans Réglages) puis « Connecter Gmail ». Quand Gmail est connecté,
    **« Envoyer » envoie vraiment** (contact → Contacté, brouillon marqué Fait,
    progression campagne) ; l'**envoi groupé** propose « Envoyer maintenant
    (Gmail) » avec délai entre envois. Sinon → repli **mailto** (brouillon).
    Honnête : **sans serveur**, gratuit dans les quotas Google (~500/j Gmail
    perso, ~2000/j Workspace) ; marche **dans l'extension installée** (pas en
    file://) ; ce n'est PAS « prendre le contrôle » du compte mais une
    autorisation d'envoi limitée. Message construit en RFC 2822 + base64url ;
    envoi réseau **non testé en session** (pas de vrai Gmail) — à valider par
    l'utilisatrice. Les brouillons portent `to/subject/body/cc/bcc` pour l'envoi.
  - **Mailing séquencé intelligent** (`runMailing` / `openMailingModal`,
    `relanceListName` / `currentListLevel`) : depuis une liste, bouton **« Envoyer
    le mailing à « X » »** → choisir un modèle → envoi. Les envoyés sont
    **déplacés automatiquement** vers la liste suivante : liste de départ →
    **« 1er mail envoyé »** → **« 2e relance »** → **« 3e relance »** (max réglable
    `DB.settings.maxRelances`, défaut 3, dans Réglages). Les **sans-email restent**
    dans la liste de départ ; échecs non déplacés. Gmail connecté = envoi réel +
    déplacement immédiat ; sinon = brouillons portant `fromTag/toTag/level` qui
    déplacent le contact **quand ils sont envoyés** (`markContactSent`). Statut →
    Contacté (niveau 1) puis Relancé, `relanceLevel` + `lastSentAt` posés.
  - **Détection des réponses** (`gmailCheckReplies` / `gmailHasReplyFrom`, scope
    `gmail.readonly` demandé à la connexion) : bouton **« Vérifier les réponses »**
    (si Gmail connecté) → interroge la boîte (`from:<lead> after:<envoi>`) ; si une
    réponse est trouvée, pose `replyAt` + passe le contact en **« En discussion »**.
    Colonne **Réponse** (« Réponse <date> ») dans le tableau Contacts. Réseau non
    testé en session (logique testée avec réponse simulée) — à valider par l'utilisatrice.
  - **Fiche contact éditable (CRM)** (`editContactCard` / `openContactCard`) :
    bouton **« + Nouveau contact »** (création manuelle) et **ouverture de la
    fiche** (clic sur le nom ou « Ouvrir ») avec tous les champs : Nom, Société,
    Email, Téléphone, Ville, Pays, Site web, Nature, Étape, Responsable,
    Fonction/poste, **Prochaine action + échéance**, Notes, Listes (via le
    sélecteur). Domaine déduit du site/email à l'enregistrement. Les
    **prochaines actions échues** remontent dans l'Assistant « À faire
    maintenant ». Champs additifs (city/country/website/owner/nextAction/
    nextActionDate) — compat ascendante, aucune migration destructive.
  - **Gestion souple des listes** (onglet Contacts) : sélection multiple →
    **Ajouter à une liste…** / **Déplacer vers…** (retire de la liste courante) /
    **Retirer de « X »** / **Changer l'étape** en masse, via un **sélecteur de
    listes** (cases à cocher des listes existantes + création inline) — plus de
    `prompt`. Par contact, « Liste » ouvre le même sélecteur en mode **exact**
    (coche = appartenance, décoche = retrait). Bouton **« Gérer les listes »** :
    renommer (met à jour tous les contacts) / supprimer une liste (les contacts
    restent). `openListPicker`, `applyListPicker`, `removeFromList`, `renameList`,
    `deleteList`, `bulkSetStage`. Objectif : déplacer les contacts entre listes
    sans friction (un CRM plus flexible, sans options inutiles).
- **Campagnes de relance** (nav « Campagnes de relance », `DB.campaigns`) :
  séquences d'emails espacées (J+0, J+3, J+7…) sur **une ou plusieurs listes**
  (`listTags[]`, cases à cocher — sépare écoles / restaurants / etc.). Chaque
  étape peut utiliser un **modèle d'email** (objet/message/Cc/PJ) ou son propre
  objet/message. « Enrôler la liste » ajoute les contacts de toutes les listes
  cochées ; `processCampaigns()` (au chargement + « Traiter maintenant ») crée un
  **brouillon d'email** par étape échue, surfacé dans « À faire maintenant »,
  **dé-doublonné** par `campKey`. Compat ascendante avec l'ancien `listTag`
  unique. Aucun envoi automatique — l'utilisatrice garde la main.

## ANALYSE DU DRIVE FORMASKILLS TRAVEL (fait via connecteur Google Drive)
Le connecteur Drive fonctionne. Contenu clé du dossier « FORMASKILLS TRAVEL / TRAVEL » :
- **CRM COMMERCIAL & PARTENARIATS — TRAVEL** (le vrai CRM). Onglets/colonnes réels :
  - Entités & contacts : Type de relation, Nom de l'entité, Pays, Ville, Adresse,
    Code postal, Contact principal, Fonction, E-mail (principal + secondaires),
    Téléphone, Site web, Statut, Dernière interaction, Prochaine action,
    Offre / intérêt, Responsable, Notes, Fichier source, Importé le.
  - Opportunités / pipeline : Statut commercial, Valeur estimée, Prochaine action,
    Échéance, Référence devis/projet, Objet de la relance.
  - Bibliothèque e-mails (mails types) : Catégorie, Langue (FR/EN…), Public, Objet,
    Corps, Pièce jointe/lien, Statut de validation, Responsable (Template_1st/2nd/3rd).
  - Campagnes : Nom, Public cible, Canal, Modèle e-mail, Date lancement, Relance 1,
    Relance 2, Prochaine action, Résultat, Responsable.
  - Prestataires locaux : Type (Salle de cours, Atelier, transport, hébergement,
    restaurant, guide…), Nom, Pays, Ville, Adresse, Site web, Mail, Contact, Tél, Statut.
- **Types de relation réels** (volumétrie) : Lycées (206), Partenaire éducation /
  petite enfance (111), Agence de voyage (57), Agence au pair (39), Entreprise/
  partenaire, Crèches, Aide à domicile, Organisme intermédiaire, Prestataires.
- **Axes commerciaux** (stratégie) : A Clients internationaux (agences étrangères,
  écoles de langues, universités, organismes Erasmus), B Clients directs
  (particuliers/familles), C Prestataires FR (autocaristes, hôtels, restaurants,
  musées, guides, activités), D Partenaires stratégiques (offices tourisme, institutions).
- Autres fichiers : BDD Entreprises Educaskills (prospects), SUIVI PARTICIPANTS,
  PLANNINGS TYPES FLE À SÈTE + COMMUNICATION & PLANNINGS (calendrier séjours),
  GESTION DOCUMENTAIRE + PROCESS + KPI, OFFRES-PRIX-COMPTA, dossier MAILS TYPES,
  DOCUMENTS MODÈLES VIERGES, GOOGLE FORMS (International Participant Registration),
  Papiers officiels (Qualiopi, accréditation, RC Pro), conventions au pair, Europass.
- **Aligné dans l'outil** : `CONTACT_CATEGORIES` + `inferCategory` reprennent la
  vraie taxonomie (Lycée/École, Crèche/Petite enfance, Université/École de langues,
  Agence de voyage, Agence au pair, Organisme intermédiaire/Erasmus, Hébergement,
  Restaurant, Transport, Activité/Visite/Guide, Salle/Atelier, Office de tourisme/
  Institution, Financeur/OPCO, Prestataire, Entreprise, Client/Particulier). Les
  **mails types** ont Langue + Public et sont **seedés** au 1er lancement
  (`seedMailTemplates` : 1er contact lycée + relance 1/2 + 1er contact prestataire).
- **Roadmap pour couvrir TOUTE l'activité** (à prioriser avec l'utilisatrice) :
  R.a Champs CRM complets sur T1 (Pays/Ville/Adresse/CP/Site/Fonction/Responsable/
  Dernière interaction/Prochaine action/Offre) ; R.b Pipeline « Opportunités »
  (statut commercial + valeur + échéance) ; R.c Module **Plannings/Calendrier des
  séjours** (FLE à Sète) — absent ; R.d **Registre documentaire + KPI** (T8) ;
  R.e Import en masse de la BDD/CRM Drive (CSV/XLSX) ; R.f Intake participants
  (Google Form → fiche). NB : le connecteur Drive n'est pas garanti connecté en
  session — l'outil reste autonome ; l'analyse Drive sert à cadrer les fonctions.

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
4. ~~**Import en masse de la BDD/CRM Drive / Airtable** (reprise en masse)~~ —
   **FAIT & TESTÉ** (24/24 checks sous CSP ; total 320). L'import intelligent de
   sheets (`detectMapping`/`smartImport`, bouton « Importer / coller » de
   l'onglet Contacts) reconnaît maintenant **toutes les colonnes du vrai CRM
   Drive** : Type de relation → **nature** (via `inferCategory`), Statut →
   **étape** du pipeline (normalisé par `normStage` : Client/actif → Gagné,
   Perdu/refus → Perdu, négociation/devis → En discussion, etc.), **Responsable**
   → owner, **Prochaine action**, **Notes** (+ **Adresse** consolidée dedans),
   Ville, Pays, Site → domaine. Priorité de colonnes corrigée : « Nom de
   l'entité » → **société**, « Contact principal » → **nom** (avant : « Nom de
   l'entité » pris pour le nom du contact). Robustesse accents : `deburrLower`
   retire les diacritiques avant le mapping des en-têtes (les en-têtes accentués
   « Société / Téléphone / Prochaine action » sont désormais reconnus).
   Compat ascendante : une simple liste Nom/Email/Tél s'importe toujours.
   Aperçu enrichi (colonnes reconnues affichées). Honnête : import dans le CRM
   contacts (le vrai CRM de l'outil) ; XLSX à convertir en CSV/collage TSV
   (l'outil lit TSV/CSV, pas le binaire .xlsx).
5. ~~**T8 Registre documentaire** par dossier (archive centralisée + statut)~~ —
   **FAIT & TESTÉ** (20/20 checks sous CSP ; total 340). Nouvelle nav **« T8 ·
   Registre documentaire »** (`VIEWS.registry`, `DB.docRegistry`). Par **dossier**
   (projet ou « Général »), on suit chaque **pièce** avec un **statut** (Manquant
   / Reçu / Validé / Expiré / N/A, éditable **inline**), une **échéance** (les
   dépassées s'affichent en rouge), un **responsable**, une **note**. KPI (total /
   manquantes / validées / à échéance < 30j), **filtres** dossier + statut,
   **export CSV**. Bouton **« Ajouter un dossier type »** = seed d'une checklist
   complète en 1 clic : **Dossier mobilité Erasmus** (convention subvention,
   convention mobilité, Learning Agreement, assurances RC + rapatriement/CEAM,
   autorisation parentale, attestation de présence, Europass, rapport participant,
   justificatifs) ou **Pièces de structure Qualiopi** (Qualiopi, accréditation
   Erasmus/OID, RC Pro, garantie financière, statuts/Kbis) — **dé-doublonné**.
   Les pièces **manquantes** ou **expirées / échéance dépassée** remontent dans
   l'Assistant « À faire maintenant » et **badgent** la nav. `docRegistry` ajouté
   à `DEFAULT_DB`, `migrate` et `COLLECTIONS` (fusion `mergeDB` anti-perte).
   Helpers : `regDossiers`, `regRows`, `registryDraw`, `openRegEntry`,
   `seedRegistry`, `delRegEntry`, `exportRegistry`, `REG_TEMPLATES`. Honnête :
   registre de suivi (métadonnées + statut) — le stockage des fichiers eux-mêmes
   reste dans le dossier Drive/local (l'outil référence, il n'héberge pas les PDF).
6. ~~Générer les **documents participants pré-remplis** depuis le projet~~ —
   **FAIT & TESTÉ** (24/24 checks sous CSP, 0 violation, 0 pageerror ; total 296).
   Bouton **« Documents »** dans la fiche d'un **projet** ou d'un **participant**
   (`openDocGen`) → choisir un modèle « participant » (attestation, conditions de
   prise en charge, ou tout modèle utilisant `{{participant}}/{{lieu}}/
   {{date_debut}}/{{date_fin}}`). Le **nom du participant**, le **lieu** (ville +
   pays) et les **dates** du séjour se remplissent **automatiquement depuis le
   projet** — champs pré-remplis mais éditables, zéro ressaisie. Sélection des
   participants (cases à cocher, tous cochés par défaut ; depuis un projet =
   participants rattachés par `project` == nom du projet ; depuis un participant =
   lui seul, projet lié résolu par nom). Génère **un document par participant**
   dans une seule fenêtre d'impression (**saut de page** entre chacun),
   en-tête/pied société appliqués. Helpers : `projectByName`,
   `participantsOfProject`, `participantDocTemplates`, `projectDocCtx`,
   `fillDocBody`, `docSheetHTML`. Honnête : impression/PDF via la fenêtre pop-up
   (autoriser les pop-ups) — pas d'envoi réseau.

7. ~~**Module Plannings / Calendrier des séjours** (R.c — FLE à Sète)~~ —
   **FAIT & TESTÉ** (22/22 checks sous CSP ; total 362). Nouvelle nav **« T9 ·
   Calendrier & plannings »** (`VIEWS.planning`), 2 onglets :
   - **Calendrier des séjours** : grille mensuelle type agenda (lun→dim), chaque
     séjour (projet daté) apparaît en **barre colorée** sur ses jours ; navigation
     mois précédent/suivant + « Aujourd'hui » ; liste des **prochains séjours**
     avec accès direct au planning. Lecture seule (dérivé des dates projet).
   - **Planning d'un séjour** : sélection d'un séjour daté → tableau **jour par
     jour** (créneaux **Matin / Après-midi / Soir**) éditable **inline**
     (sauvegarde auto). Bouton **« Modèle FLE »** pré-remplit les journées vides
     (semaine : cours de FLE le matin + activité l'après-midi + temps libre ;
     week-end : programme allégé). **« Imprimer / PDF »** génère un planning
     propre (en-tête/pied société). Stocké sur le projet (`project.planning`),
     additif, compat ascendante, synchronisé via `mergeDB` (collection projects).
   Helpers : `datedProjects`, `projSpansDay`, `planDays`, `planCalendar`,
   `planDaily`, `setPlanSlot`, `planSeedFLE`, `planClear`, `planPrint`, `planOpen`.
   CSS calendrier ajouté dans `index.html` (`.calgrid`, `.calcell`, `.calbar`).
   Honnête : les séjours plannables sont ceux qui ont une **date de début** (à
   renseigner dans la fiche projet T2).

8. ~~**Pipeline commercial / Opportunités** (R.b)~~ — **FAIT & TESTÉ** (18/18
   checks sous CSP ; total 380). Nouvelle nav **« Pipeline commercial »**
   (`VIEWS.pipeline`). Les contacts ayant une **valeur estimée (€)** deviennent
   des **opportunités**, affichées en **tableau entonnoir** (kanban) par étape
   (À contacter → Contacté → Relancé → En discussion → Gagné / Perdu), avec
   **glisser-déposer** pour changer d'étape. En-tête de colonne = nombre + **somme
   €**. KPI : **pipeline ouvert** (€), **prévisionnel pondéré** (valeur ×
   probabilité d'étape via `STAGE_WEIGHTS` : 10/25/40/60/100/0 %), **gagné** (€),
   nombre d'opportunités. **Filtre par responsable**, **export CSV**, bouton
   « + Nouvelle opportunité ». Champs additifs sur le contact : **value**
   (valeur estimée) + **closeDate** (échéance prévisionnelle), éditables dans la
   **fiche contact** (`editContactCard`). Fix : la sauvegarde d'une fiche contact
   rafraîchit désormais la vue courante (avant : `finderSaved()` inconditionnel →
   `null.innerHTML` hors onglet Contacts). Helpers : `oppValue`, `pipelineOpps`,
   `pipelineDraw`, `wirePipeline`, `exportPipeline`, `STAGE_WEIGHTS`.

9. ~~**Expériences & lieux + Constructeur d'itinéraire** (T10 — demande explicite
   « experience builder »)~~ — **FAIT & TESTÉ** (28/28 checks sous CSP ; total 408).
   Deux nouvelles nav :
   - **« T10 · Expériences & lieux »** (`VIEWS.experiences`, `DB.experiences`) :
     bibliothèque de tout ce que les visiteurs peuvent faire (musées, restaurants,
     activités, événements, plages, parcs…). **Cartes éditables** affichant, comme
     demandé : **nom** en gras, **adresse** juste dessous, **jours d'ouverture**,
     **prix / personne** (ou **« Gratuit »**), et un **badge pilule coloré** en
     haut à droite par **catégorie** (`EXP_CATEGORIES`, 12 catégories = 12
     couleurs). Champs : ville, adresse, prix, durée, ouverture, **lat/lng**
     (pour les trajets), site, partenaire, notes. Filtres ville/catégorie +
     recherche, **export CSV**, seed d'**exemples Sète/Montpellier** (Musée Fabre,
     Musée Paul Valéry, Mont Saint-Clair, Les Halles, plages…).
   - **« Constructeur d'itinéraire »** (`VIEWS.itinerary`, `DB.itineraries`) :
     atelier **glisser-déposer** — palette d'expériences (filtrable) à gauche,
     **journées** à droite ; on glisse une carte dans une journée (ou clic =
     ajout au J1). **Nombre de participants** réglable (petit/grand groupe) →
     **prix total = Σ(prix) × participants** calculé automatiquement. Entre deux
     activités, un **trajet** avec **bascule à pied / bus-tram / voiture**
     (`cycleLeg`), **distance à vol d'oiseau** (Haversine) + **temps estimé** par
     mode, et un **lien Google Maps** pré-rempli (mode + coords) qui ouvre le vrai
     trajet en ligne. **Suggestions intelligentes** de la suite (`suggestNext` :
     même ville, catégorie différente, proximité, enchaînement logique
     musée→déjeuner→visite→café…). Réordonner (↑/↓ ou glisser entre journées),
     retirer, ajouter/supprimer des journées, **imprimer / PDF** l'itinéraire
     (jours + trajets + total). Mode de transport auto-sélectionné (`autoMode` :
     transport si > 1,5 km).
   `experiences` + `itineraries` ajoutés à `DEFAULT_DB`/`migrate`/`COLLECTIONS`
   (fusion `mergeDB` anti-perte). CSS ajouté (`.expcard`, `.exptag`, `.itin-wrap`,
   `.itin-day`, `.itin-item`, `.leg`, `.pal-card`). Icônes `pin` + `route`.
   Helpers : `expColor`, `expRows`, `expCardHTML`, `openExpEntry`, `seedExperiences`,
   `haversineKm`, `legInfo`, `autoMode`, `mapsDirUrl`, `itinTotals`, `suggestNext`,
   `addExpToDay`, `cycleLeg`, `moveItinItem`, `itinPrint`, `FLOW_NEXT`, `ITIN_MODES`.
   **Routage & géocodage 100% GRATUITS (OpenStreetMap)** — `Geo` (app.js) :
   **Nominatim** (`nominatim.openstreetmap.org`) géocode les adresses → lat/lng
   (bouton **« Compléter les coordonnées (gratuit) »** dans Expériences,
   `geocodeMissing`, 1 req/s poli) ; **OSRM** (`router.project-osrm.org`) calcule
   les **distances/temps sur routes réelles** (bouton **« Vraies distances
   (gratuit) »** dans l'itinéraire, `itinComputeRoutes`, cache `item.osrm`).
   Aucune clé, aucun abonnement. `legFor` privilégie la distance réelle et **se
   replie automatiquement** sur l'estimation à vol d'oiseau si hors ligne. Marche
   dans l'extension installée (host_permissions `<all_urls>`) et en mode fichier
   (CORS ouvert côté OSM). Honnête : le transit fin (horaires bus/tram en direct)
   reste hors périmètre gratuit sans clé — le mode « bus/tram » estime le temps à
   partir de la distance routière ; le **lien Google Maps** ouvre le vrai trajet
   transit en ligne. Serveurs publics OSM/OSRM = usage raisonnable (petits volumes).

## « Hors-ligne » — précision importante
L'outil N'EST PAS que hors-ligne. Il **navigue en ligne** : il ouvre et lit de
vraies pages (Google, Google Maps, LinkedIn, sites) via l'extension pour en
**récupérer les contacts**. « Hors-ligne / autonome » signifie ici : **pas de
serveur à héberger, pas d'API payante, pas d'abonnement** — les données restent
chez l'utilisatrice. La récupération de contacts sur Google / Maps / LinkedIn est
une fonctionnalité **en ligne** assumée et centrale.

## Limites assumées (à répéter honnêtement à l'utilisatrice)
- Impossible hors-ligne : **révéler l'email caché** d'un profil LinkedIn (Skrapp
  utilise un serveur payant). L'outil récupère nom/poste/société et **devine**
  l'email quand le domaine est connu.
- Impossible hors-ligne : vraie **vérification SMTP** « boîte existe » (on fait
  syntaxe + heuristiques : jetable/générique/perso/pro).
- Vraie synchro cloud multi-utilisateurs temps réel = exigerait un serveur payant
  + OAuth (source de bugs) : on s'appuie sur le fichier + Google Drive à la place.
- **Waalaxy / robots LinkedIn** (auto-connexion, auto-messages en masse,
  séquences sur LinkedIn) : HORS PÉRIMÈTRE — viole les CGU de LinkedIn et fait
  bannir les comptes. On ne code pas d'automatisation abusive de plateforme.
  L'outreach se fait via brouillons `mailto:` + campagnes (l'humain garde la main).
- **Copie de code de scrapers GitHub** : non — la plupart sont en Python
  (serveur) et sous licence GPL/AGPL (contaminerait le dépôt). Les techniques
  utiles (dé-obfuscation, exploration de site) sont ré-implémentées proprement
  en JS local (clean-room), sans coller de code tiers.
- **Navigateurs anti-détection** (Multilogin, Dolphin Anty) : HORS PÉRIMÈTRE. Leur
  cœur (falsifier l'empreinte canvas/WebGL/UA, isoler des profils, router des
  proxies pour échapper aux anti-abus des plateformes) est (1) techniquement
  impossible dans une extension MV3/fichier local sans serveur et (2) de
  l'évasion de détection qu'on ne code pas. On a repris seulement les intentions
  légitimes et compatibles : cadence polie du scraper, multi-expéditeurs,
  campagnes de relance.

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

## Principe directeur (consigne utilisatrice)
Chaque fois qu'un blocage apparaît, trouver une **solution 100% GRATUITE** (pas
d'API payante, pas d'abonnement, pas de clé si possible) — l'outil doit au final
être **complet et fonctionnel**. Ex. déjà appliqué : routage/géocodage via
**OpenStreetMap (Nominatim + OSRM)** au lieu de Google Directions payant ; envoi
email via **Gmail API OAuth gratuit** au lieu d'un SMTP payant ; scraping via
l'extension au lieu d'un serveur de scraping payant. Toujours documenter la
solution gratuite retenue et son repli hors-ligne.

## Prochaine action suggérée
Points **1** (automatisations n8n), **4** (import CRM Drive), **5** (T8 registre),
**6** (documents participants), **7 / R.c** (calendrier & plannings), **8 / R.b**
(pipeline commercial) et **9 / T10** (expériences & constructeur d'itinéraire, +
routage/géocodage gratuit OSM) sont **livrés et testés**. Reste le point **3
(export CSV auto vers Drive)** et **R.f (intake participants Google Form → fiche)**.
Améliorations possibles sur T10 : événements datés, **génération d'un devis
directement depuis un itinéraire** (reprendre le total calculé). Avant de coder
une nouvelle UI : relire cette liste, vérifier qu'aucun handler inline n'est
introduit, tester sous CSP (423 checks de référence : csptest.mjs → csptest21.mjs).
