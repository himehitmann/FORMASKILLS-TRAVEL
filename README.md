# Formaskills Travel OS

Outil de gestion **100 % autonome** pour Formaskills Travel : un seul fichier HTML
qui remplace **Airtable** (tables T1→T9 + conformité R1→R8) et **Make**
(moteur d'automatisations), et qui embarque un **chercheur de contacts / emails**
hors-ligne inspiré des extensions type Skrapp / Hunter / Snov.

## Pourquoi c'est fait comme ça

Le cahier des charges était clair : **rien à payer, aucune dépendance à un
autre outil ou service, ça doit fonctionner toujours, même hors-ligne, même
sans Claude, et tout doit se sauvegarder.**

La seule architecture qui respecte réellement tout ça est un **fichier HTML
unique, sans serveur, sans CDN, sans API**. Il ne peut donc pas « tomber en
panne » à cause d'un service tiers. Les données vivent dans le navigateur
(`localStorage`) et s'exportent en un fichier JSON de sauvegarde.

## Lancer l'outil

Ouvrir `app/index.html` dans n'importe quel navigateur (double-clic).
C'est tout — aucune installation. Pour l'avoir toujours sous la main :
mettre le fichier dans un dossier, créer un marque-page.

## Ce que fait l'outil

| Écran | Rôle |
|---|---|
| **Tableau de bord** | KPI (marge, projets, participants), entonnoir de prospection, calcul inverse « objectif de CA → nombre de prospects ». |
| **Chercheur de contacts** | 🔎 **Par nom** : devine les emails (nom + domaine, 12 modèles classés par probabilité) · 🌐 **Par domaine** : liste les adresses de service (contact@, sales@, rh@…) par département, façon Hunter Domain Search · 📚 **En masse** : colle une liste (Prénom, Nom, Domaine) → email de chacun → export CSV · 📋 **Extraire d'une page** : tous les emails, téléphones, sites, réseaux d'un texte collé — hors LinkedIn, site par site · 👤 **Profil / LinkedIn** : colle un profil → nom, poste, société, email, téléphone (équivalent hors-ligne d'un scraper) · 🧠 **Modèle** : apprend le format d'une boîte depuis un seul email connu · ✔️ **Vérifier** (syntaxe, jetable, générique, format pro) · 💾 **Contacts** : listes/étiquettes, import & export CSV, déduplication · 📌 **Bookmarklet** « sur toute page » : extrait les contacts de n'importe quel site sans installer d'extension, 100 % local. |
| **T1 Partenaires** | CRM de prospection (Kanban glisser-déposer + tableau) : CFA, écoles, OPCO, entreprises. |
| **T2 Projets** | Chaque mobilité + sa **conformité Erasmus R1→R8** (cases à cocher « prêt pour l'audit »). |
| **T3 Participants** | Apprenants, mineurs, assurances, statut de dossier. |
| **Finances** | Calculateur de marge séjour (FLE €/h, autres coûts) + lignes budgétaires. |
| **Devis & documents** | 🧾 **Devis & 🧾 Factures** numérotés (D-2026-… / F-2026-…), un devis se **convertit en facture** en un clic, pré-remplis depuis un partenaire (T1), lignes + totaux + marge, statuts (Envoyé/Accepté, Émise/Payée/En retard), **imprimables en PDF** · 📄 **Modèles** (attestation de présence, email de prospection, conditions de prise en charge…) tous **modifiables** — même ceux fournis — remplis en un clic, variables `{{…}}` personnalisables · 🏢 **Fiche société** unique (SIRET, adresse, IBAN…) qui alimente automatiquement tous les documents · 🎨 **Mise en page** : logo, couleur d'accent, en-tête et pied de page **modifiables à tout moment**, appliqués partout. **Fini la ressaisie.** |
| **T6 Prestataires** | Hôtels, guides, transporteurs, contrats. |
| **T7 Tâches** | Échéances, priorités, rappels ; les retards remontent au tableau de bord. |
| **Automatisations** | Règles **QUAND … ALORS …** qui tournent dans l'outil (remplace Make). |
| **Réglages** | Objectifs, thème clair/sombre, **export / import JSON**, réinitialisation. |

## Chercheur de contacts — ce qui est possible hors-ligne (et ce qui ne l'est pas)

Les extensions payantes (Skrapp, Hunter, Snov…) reposent sur **deux** briques :
1. des **algorithmes** (permutation de patterns, apprentissage de modèle,
   extraction, classification) — **entièrement reproduits ici, hors-ligne** ;
2. un **serveur** qui confirme qu'une boîte mail existe vraiment (SMTP) et
   interroge des bases de données propriétaires — **impossible sans réseau**,
   donc volontairement écarté pour garder l'autonomie et la gratuité totales.

Résultat : l'outil génère des adresses **probables** classées par confiance, et
l'onglet « Apprendre un modèle » donne une fiabilité quasi certaine dès qu'un
seul email de l'entreprise est connu. La vérification est honnête sur ses
limites (elle ne prétend jamais confirmer une boîte réelle).

## Sauvegarde

Tout est enregistré en continu dans le navigateur. **Exportez régulièrement**
un fichier de sauvegarde (bouton `⤓` dans la barre latérale ou Réglages) pour
archiver ou transférer vos données sur un autre ordinateur.

## Structure

```
app/index.html   ← l'application complète (HTML + CSS + JS, sans dépendance)
README.md
```
