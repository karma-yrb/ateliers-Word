# GitHub Issues Backlog

Copiez chaque bloc ci-dessous tel quel dans une issue GitHub.

---

## Issue 1 - Aligner le comportement `refresh` entre Word et Excel

**Type**: Bug  
**Priorité**: P0

### Description

Garantir que l'atelier Excel se comporte exactement comme Word lors d'un rafraîchissement de page, quel que soit l'écran courant.

### Critères d'acceptation

- Un `refresh` sur `Accueil` conserve le bon utilisateur affiché.
- Un `refresh` sur `Progression` recharge la progression du bon dossier.
- Un `refresh` sur `Exercice` rouvre le bon exercice.
- Si une permission dossier doit être redemandée, l'état utilisateur reste compréhensible.
- Word et Excel passent les mêmes scénarios de reprise.

---

## Issue 2 - Aligner le changement d'utilisateur entre Word et Excel

**Type**: Bug  
**Priorité**: P0

### Description

Uniformiser le flux `Changer d'utilisateur` dans Excel pour qu'il recharge toujours la bonne session, comme dans Word.

### Critères d'acceptation

- Le changement d'utilisateur depuis le header fonctionne.
- Le changement d'utilisateur depuis la page profil fonctionne.
- Le prénom, les initiales et le dossier affichés sont mis à jour immédiatement.
- La progression affichée correspond au nouvel utilisateur.
- Aucun état de l'utilisateur précédent ne reste visible après bascule.

---

## Issue 3 - Ajouter des tests de non-régression sur la reprise de session

**Type**: Test  
**Priorité**: P0

### Description

Créer une couverture de tests pour les cas métier critiques liés au rafraîchissement et à la reprise.

### Critères d'acceptation

- Un test couvre la reprise sur `home`.
- Un test couvre la reprise sur `exercise/:id`.
- Un test couvre la reprise avec profil local sans permission réaccordée.
- Un test couvre le rechargement du bon utilisateur après restauration de session.
- Les tests échouent si le hash ou l'utilisateur restauré est incorrect.

---

## Issue 4 - Ajouter des tests de non-régression sur le changement d'utilisateur

**Type**: Test  
**Priorité**: P0

### Description

Sécuriser le flux de bascule entre deux usagers avec des progressions différentes.

### Critères d'acceptation

- Un test couvre la bascule d'un utilisateur A vers un utilisateur B.
- Le test vérifie que la progression A n'apparaît plus après bascule.
- Le test vérifie que la progression B est bien chargée.
- Le test couvre un changement d'utilisateur depuis le header.
- Le test couvre un changement d'utilisateur depuis la page profil.

---

## Issue 5 - Documenter et verrouiller le contrat DOM commun

**Type**: Tech debt  
**Priorité**: P0

### Description

Formaliser les éléments HTML obligatoires attendus par le runtime partagé pour tous les ateliers.

### Critères d'acceptation

- Une documentation liste les IDs et éléments DOM critiques.
- Word et Excel respectent ce contrat.
- Des tests simples valident les IDs essentiels.
- Toute divergence de contrat casse les tests.
- Le bouton principal de fichier de travail est couvert par test dans chaque atelier.

---

## Issue 6 - Renommer les abstractions communes trop spécifiques à Word

**Type**: Refactor  
**Priorité**: P1

### Description

Rendre le vocabulaire technique neutre pour supporter proprement plusieurs ateliers.

### Exemples

- `docxUrl` -> `workFileUrl`
- `exercise-docx-btn` -> `exercise-workfile-btn`

### Critères d'acceptation

- Les noms partagés ne font plus référence à Word.
- La migration est compatible pendant la phase transitoire.
- Word et Excel utilisent le nouveau vocabulaire.
- Les anciens alias sont supprimés une fois les apps alignées.
- Les tests existants restent verts.

---

## Issue 7 - Faire de `atelier-core` la source unique du runtime

**Type**: Refactor  
**Priorité**: P1

### Description

Supprimer la logique de `source multiple` pour le runtime navigateur commun.

### Critères d'acceptation

- `packages/atelier-core/browser/*` est la seule source modifiable du runtime partagé.
- Les copies dans `apps/*/js/core/*` sont régénérées automatiquement.
- La règle d'édition est documentée.
- Aucune correction du core n'exige une modification manuelle dans plusieurs endroits.
- La synchro Word et Excel reste fonctionnelle.

---

## Issue 8 - Ajouter un contrôle anti-dérive entre core et apps

**Type**: Build/CI  
**Priorité**: P1

### Description

Empêcher la publication d'un atelier désaligné du runtime partagé.

### Critères d'acceptation

- Un script compare `atelier-core` avec les copies synchronisées.
- Le contrôle est lancé dans `test`, `release` ou CI.
- En cas d'écart, le pipeline échoue avec un message clair.
- Word et Excel passent ce contrôle dans l'état nominal.
- Le workflow de correction est documenté.

---

## Issue 9 - Extraire les modules métier du contrôleur partagé

**Type**: Refactor  
**Priorité**: P2

### Description

Découper le contrôleur commun en sous-domaines plus lisibles et testables.

### Sous-domaines visés

- gestion utilisateur
- reprise et navigation
- progression
- gestion du fichier de travail

### Critères d'acceptation

- Le contrôleur est réduit en complexité.
- Les responsabilités sont séparées dans des modules dédiés.
- Les tests couvrent les principaux modules extraits.
- Le comportement métier reste inchangé.
- Word et Excel continuent d'utiliser le même socle.

---

## Issue 10 - Introduire une configuration standard par atelier

**Type**: Architecture  
**Priorité**: P2

### Description

Regrouper les spécificités Word et Excel dans une configuration claire plutôt que dans des divergences de structure.

### Exemples

- nom de l'atelier
- extension de fichier
- types MIME
- libellés d'interface
- textes d'aide

### Critères d'acceptation

- Les différences entre ateliers passent par une config explicite.
- Le core ne dépend plus de noms historiques implicites.
- Ajouter un nouvel atelier ne nécessite pas de fork du runtime.
- Word et Excel utilisent le même mécanisme de configuration.
- La documentation d'ajout d'un atelier est mise à jour.

---

## Issue 11 - Préparer un template d'atelier réutilisable

**Type**: Improvement  
**Priorité**: P3

### Description

Créer un squelette standard pour accélérer la création de futurs ateliers.

### Critères d'acceptation

- Un template documenté permet de créer un nouvel atelier.
- Le template inclut la config, les tests de contrat et la synchro core.
- Les conventions de structure sont explicites.
- Le template est validé sur Word ou Excel comme référence.
- Le coût d'ajout d'un futur atelier est réduit.
