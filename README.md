# Formaskills Travel OS

Outil de gestion **100 % autonome** pour Formaskills Travel. Un seul dossier,
aucune dépendance, aucun abonnement, aucun serveur : il fonctionne pour
toujours, même hors-ligne, et tout ce que vous faites se sauvegarde tout seul.

Il remplace **Airtable** (données T1→T9 + conformité Erasmus R1→R8), **Make**
(automatisations) et les **extensions d'email-finder** (Skrapp, Hunter, Snov…)
par un seul outil, plus simple et mieux guidé.

## Deux façons de l'utiliser

### 1. Application simple (le plus rapide)
Ouvrez `app/index.html` dans n'importe quel navigateur (double-clic). Tout
fonctionne, sauf le scraping direct sur LinkedIn/le web (qui a besoin du mode
extension ci-dessous). Le bookmarklet et « Extraire d'une page » couvrent déjà
la récupération de contacts sans rien installer.

### 2. Extension Chrome (débloque le scraping LinkedIn & web)
1. Téléchargez le dépôt (bouton **Code → Download ZIP** sur GitHub) et
   décompressez-le.
2. Ouvrez Chrome → `chrome://extensions` → activez **Mode développeur**.
3. Cliquez **Charger l'extension non empaquetée** et sélectionnez le dossier
   **`app`** (celui qui contient `manifest.json`).
4. Cliquez l'icône de l'extension : l'outil s'ouvre, onglet « Scraper » actif.

Le `manifest.json`, le service worker et les icônes sont tous dans `app/`.

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

## Sauvegarde & autonomie

Tout est enregistré en continu dans le navigateur (localStorage), en simple
fichier comme en extension. **Exportez régulièrement** une sauvegarde (bouton
« Sauvegarde ») pour archiver ou transférer vos données. L'outil ne dépend
d'aucun service tiers : il ne peut pas « tomber en panne » à cause d'un autre
logiciel.

## Structure du dépôt

```
app/
  index.html      ← l'application complète (HTML + CSS + JS, sans dépendance)
  manifest.json   ← extension Chrome (Manifest V3)
  background.js   ← service worker (ouvre l'app au clic sur l'icône)
  icons/          ← icônes de l'extension
README.md
```
