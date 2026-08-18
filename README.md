# Formaskills Travel OS

Outil de gestion **100 % autonome** pour Formaskills Travel. Un seul dossier,
aucune dépendance, aucun abonnement, aucun serveur : il fonctionne pour
toujours, même hors-ligne, et tout ce que vous faites se sauvegarde tout seul.

Il remplace **Airtable** (données T1→T9 + conformité Erasmus R1→R8), **Make**
(automatisations) et les **extensions d'email-finder** (Skrapp, Hunter, Snov…)
par un seul outil, plus simple et mieux guidé.

## Deux façons de l'utiliser

### 1. Application simple (le plus rapide)
Ouvrez `index.html` dans n'importe quel navigateur (double-clic). Tout
fonctionne, sauf le scraping direct sur LinkedIn/le web (qui a besoin du mode
extension ci-dessous). Le bookmarklet et « Extraire d'une page » couvrent déjà
la récupération de contacts sans rien installer.

### 2. Extension Chrome (débloque le scraping LinkedIn & web)
1. Sur GitHub, bouton **Code → Download ZIP**, puis décompressez le fichier.
2. Ouvrez Chrome → `chrome://extensions` → activez **Mode développeur** (en haut
   à droite).
3. Cliquez **Charger l'extension non empaquetée** et sélectionnez le **dossier
   décompressé** (celui qui contient directement `manifest.json`).
4. Cliquez l'icône de l'extension : l'outil s'ouvre, onglet « Scraper » actif.

Le `manifest.json`, le service worker et les icônes sont **à la racine** du
dépôt — le dossier que vous décompressez est donc directement l'extension.

## Ce que fait l'outil

| Écran | Rôle |
|---|---|
| **Tableau de bord** | Assistant **« À faire maintenant »** : l'outil analyse vos données et vous dit quoi faire, priorisé, avec un bouton par action (contacter un prospect, relancer un devis, facture en retard, conventions à signer avant un départ, dossier incomplet…). Puis KPI, entonnoir de prospection, calcul inverse « objectif de CA → nombre de prospects ». |
| **Chercheur de contacts** | **Scraper LinkedIn / Web** (mode extension) : récupère emails, téléphones et noms depuis un profil LinkedIn (onglet actif) ou en lançant une **recherche web multi-pages** (choisissez le nombre de pages et de sites à visiter). Plus, hors-ligne : deviner un email par nom, par domaine, en masse (CSV), extraire d'une page collée, parser un profil, apprendre un modèle, vérifier, bookmarklet « sur toute page ». |
| **T1 Partenaires** | CRM de prospection (Kanban + tableau). |
| **T2 Projets** | Mobilités + conformité Erasmus R1→R8. |
| **T3 Participants** | Apprenants, mineurs, assurances, dossiers. |
| **Finances** | Calculateur de marge séjour + lignes budgétaires + **enveloppe Erasmus** (déduction automatique par projet). |
| **Devis & documents** | **Devis & factures** (conversion en 1 clic), **modèles** de documents personnalisables, **fiche société** unique, **mise en page** (logo, couleurs, en-tête/pied de page) modifiable à tout moment. Tout imprimable en PDF. |
| **T6 Prestataires** | Hôtels, guides, transporteurs, contrats. |
| **T7 Tâches** | Échéances, priorités, rappels ; retards remontés au tableau de bord. |
| **Automatisations** | Règles QUAND … ALORS … (remplace Make). |
| **Réglages** | Objectifs, thème clair/sombre, **export / import** de sauvegarde. |

## Tableaux : puissants et libres

Chaque tableau (T1, T2, T3, T6, T7) offre :
- **Recherche** + **filtre par statut** ;
- **Sélection multiple** (cases à cocher) → **suppression** ou **modification en
  masse** ;
- **Colonnes personnalisées** : ajoutez vos propres colonnes (texte, nombre,
  date, texte long) quand vous voulez, via le bouton « Colonnes » ;
- vues **Kanban** (glisser-déposer) et **Tableau** ;
- **export CSV**.

## Le scraper — ce qui est possible, honnêtement

- **Mode extension** : lit la page que **vous** consultez (LinkedIn, annuaires,
  sites) et extrait les contacts visibles ; le mode « recherche web » ouvre les
  résultats et visite les sites pour vous. Aucune donnée n'est envoyée ailleurs.
- **Ce qui n'est volontairement pas fait** : la vérification SMTP « boîte réelle »
  et les bases de données propriétaires des services payants — elles exigent un
  serveur, ce qui casserait l'autonomie et la gratuité. Les emails devinés sont
  donnés en **probabilité** (quasi certains via « Apprendre un modèle »).

## Où sont stockées mes données ? (important)

Vos données sont enregistrées **sur cet ordinateur**, dans le stockage du
navigateur / de l'extension (localStorage, doublé dans `chrome.storage.local`
en mode extension). Elles **restent** après fermeture, redémarrage, et même
mise à jour/rechargement de l'extension.

**Deux cas où elles ne suivent pas toutes seules :**
- si vous **désinstallez** l'extension,
- si vous voulez les retrouver sur un **autre ordinateur**.

La solution sûre et sans dépendance : **exporter un fichier de sauvegarde**
(bouton « Sauvegarde », ou l'action que l'outil vous rappelle chaque semaine sur
le tableau de bord) et le garder où vous voulez (votre Drive, une clé USB…).
Pour restaurer / changer d'ordinateur : **Réglages → Importer une sauvegarde**.
L'outil ne dépend ainsi d'aucun service tiers et ne peut pas « tomber en panne ».

## Structure du dépôt (= l'extension, à la racine)

```
index.html      ← la page de l'application (HTML + CSS)
app.js          ← toute la logique (chargée par index.html ; sans dépendance)
manifest.json   ← extension Chrome (Manifest V3)
background.js   ← service worker (ouvre l'app au clic sur l'icône)
icons/          ← icônes de l'extension
README.md
```

> Note technique : les extensions Chrome (Manifest V3) interdisent le code
> « inline ». C'est pourquoi la logique vit dans `app.js` (chargé par la page)
> et non dans une balise `<script>` interne — sinon l'extension afficherait une
> page vide. Le tout reste 100 % local, sans aucune dépendance externe.
