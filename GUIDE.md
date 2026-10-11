# Guide de mise en ligne — Formaskills Travel

Ce guide est écrit pour être compris **sans être développeur**. Il explique
comment voir le site, le mettre en ligne, et surtout **ce qu'il reste à compléter**
(tous les emplacements marqués ⚑ sur le site).

---

## 1. Voir le site

- **Aperçu rapide (sans rien installer)** : ouvrez le lien privé que je vous ai
  donné dans la conversation (une adresse `claude.ai/artifact/...`). Il s'ouvre
  dans votre navigateur, connecté à votre compte.
- **Sur votre ordinateur** : le code est sur GitHub, branche
  `claude/formaskills-travel-redesign-evgnzu`. Une fois le dossier récupéré,
  ouvrez un terminal dedans et lancez `python3 -m http.server 8000`, puis ouvrez
  `http://localhost:8000`.

---

## 2. Mettre le site en ligne (hébergement)

Le site est **100 % statique** (des fichiers HTML/CSS/JS, aucune base de données) :
il peut être hébergé gratuitement et très simplement. Options recommandées, de la
plus simple à la plus technique :

1. **Netlify** (le plus simple) : créez un compte, glissez-déposez le dossier du
   site, c'est en ligne en quelques secondes. Vous pourrez ensuite brancher votre
   nom de domaine `formaskills-travel.fr`.
2. **Vercel** ou **Cloudflare Pages** : similaires, connectés à votre dépôt GitHub
   (chaque modification se met en ligne automatiquement).
3. **Hébergement classique (OVH, Infomaniak…)** : envoyez les fichiers par FTP
   dans le dossier public (`www` ou `public_html`).

> Astuce : pour une page d'erreur propre, configurez votre hébergeur pour servir
> `404.html` en cas de page introuvable (Netlify le fait automatiquement).

---

## 3. ⚑ À compléter avant publication (checklist)

Rien n'a été inventé sur le site. Tous les éléments ci-dessous sont des
emplacements à remplir avec **vos vraies informations**.

### Coordonnées & identité
- [ ] **Téléphone** (barre du haut, pied de page, page Contact)
- [ ] **Adresse postale complète**
- [ ] **Liens réseaux sociaux** (Facebook, Instagram, LinkedIn — icônes du pied de page)
- [ ] **Carte Google** à intégrer sur la page Contact

### Confiance
- [ ] **Vrais avis Google** (page d'accueil — section « Ils nous font confiance »)
      → remplacez les 3 cartes « Avis à ajouter » par de vrais avis vérifiables.

### Offres & tarifs
- [ ] Vérifier **horaires, niveaux et formats** des cours FLE (page Français/FLE)
- [ ] Confirmer les **formules Au Pair** et l'accompagnement
- [ ] Les **prix** restent « sur devis » (aucun prix affiché) — à ajuster si vous
      voulez en afficher.

### Partenaires
- [ ] Ajouter vos **conditions réelles de partenariat** (commission, modalités)
      sur la page Partenaires — aucun chiffre n'est inventé.

### Légal (important)
- [ ] **Mentions légales** : raison sociale, forme juridique, SIREN/SIRET, TVA,
      n° de déclaration d'activité, directeur de publication, hébergeur.
- [ ] **Politique de confidentialité (RGPD)** : responsable du traitement, durées
      de conservation, outils utilisés.
- [ ] **CGV** : à compléter et **faire valider par un juriste**.

### Images
- [ ] Les illustrations actuelles sont des **dessins maison** (ils ne cassent
      jamais). Vous pouvez les **remplacer par vos photos** (Sète, cours, groupes,
      familles d'accueil) quand vous les aurez — envoyez-les-moi et je les intègre.

---

## 4. Les formulaires (comment ça marche aujourd'hui)

Les formulaires (**Consultation gratuite**, **Contact**, **Newsletter**,
**Partenaires**) fonctionnent **sans serveur** : quand un visiteur valide, son
application e-mail s'ouvre **pré-remplie** vers `contact@formaskills-travel.fr`.
Vous recevez donc les demandes dès maintenant.

**Pour une réception 100 % automatique** (sans que le visiteur ait à envoyer
l'e-mail lui-même), on peut brancher un service gratuit comme **Formspree** :
1. Créez un compte Formspree et un formulaire → vous obtenez une adresse `https://formspree.io/f/xxxx`.
2. Dites-le-moi : je modifie les formulaires pour envoyer directement à cette adresse.

---

## 5. Modifier les textes

- Le site est en **français par défaut**, avec un bouton **FR / EN** en haut.
- Chaque texte traduit a une version anglaise dans le code (attribut `data-en`).
  Pour modifier un texte, cherchez-le dans le fichier `.html` correspondant.
- Les couleurs sont centralisées en haut de `assets/css/styles.css` (section
  « Design Tokens ») : changer une couleur là se répercute sur tout le site.

---

## 6. Structure du site (18 pages)

| Page | Fichier |
|---|---|
| Accueil | `index.html` |
| Programmes (aperçu) | `programs.html` |
| Français (FLE) | `fle.html` |
| Au Pair | `aupair.html` |
| Job Shadowing | `jobshadowing.html` |
| Erasmus+ | `erasmus.html` |
| Voyages éducatifs & culturels | `voyages.html` |
| Exemple de programme | `program.html` |
| Destinations | `destinations.html` |
| Ressources (guides) | `ressources.html` |
| À propos | `about.html` |
| Consultation gratuite | `inquiry.html` |
| Contact | `contact.html` |
| Devenir partenaire | `partenaires.html` |
| Mentions légales | `legal.html` |
| Confidentialité | `privacy.html` |
| CGV | `terms.html` |
| Page 404 | `404.html` |

Bon lancement ! Pour toute modification, il suffit de me dire précisément ce que
vous voulez changer.
