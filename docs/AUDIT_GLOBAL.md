# Audit Global - Atelier Word

Date: 27 avril 2026  
Perimetre audite: architecture applicative, donnees pedagogiques, outillage de dev et maintenabilite.

## Synthese executive

Etat global: **fonctionnel et exploitable**, avec une base MVC claire et un dataset riche (213 exercices).  
Risque principal actuel: **maintenabilite** (duplication `root/` + `app/`, absence de CI, couverture tests initiale encore limitee).

## Constats (priorises)

### 1) Fonctionnel utilisateur
- Le bouton `Reinitialiser progression` ne supprimait pas le profil (prenom + dossier memorise).
- Correction realisee: ajout de `Reinitialiser profil local` pour effacer les preferences locales et relancer la configuration utilisateur.

### 2) Donnees pedagogiques
- Dataset: 32 modules, 213 exercices (`logs/audit-report.json`).
- 1 module sans exercices: `m10` (Impression).
- 2 exercices sans docx: `ex-182`, `ex-186`.
- 1 exercice sans image resultat: `ex-001`.
- 34 exercices avec instructions courtes (< 2 etapes), soit 16%.
- 11 exercices avec au moins une etape trop longue (> 220 caracteres), soit 5%.

### 3) Architecture / code
- Points positifs:
  - MVC lisible (`model/view/controller/storage`).
  - Separation des donnees (`data/`) et logique.
  - Persistences utilisateur bien segmentees (progression + profil).
- Points a risque:
  - Double arborescence `./` et `app/` avec fichiers miroirs (risque de divergence).
  - Pas de pipeline CI automatise (tests non bloques avant livraison).

### 4) Outillage dev
- Avant cette passe: pas de `package.json`, pas de versioning standardise, pas de tests automatises.
- Mise a niveau realisee:
  - `standard-version` configure (`package.json`, `.versionrc.json`).
  - Base de tests unitaires Node ajoutee (`tests/model.test.mjs`).
  - Script d'audit data ajoute (`scripts/audit-exercises.mjs`).
  - Scripts data corriges pour des chemins robustes (execution depuis la racine projet).

## Recommandations (ordre conseille)

1. Industrialiser la livraison:
   - Ajouter une CI simple (`npm test` + `npm run audit:data`).
2. Reduire le risque de divergence:
   - Definir un seul dossier source et un script de build/copie vers `app/`.
3. Elever la qualite pedagogique:
   - Traiter en priorite les 34 exercices a consignes courtes.
4. Assainir les trous de contenu:
   - Completer docx manquants et verifier `m10`.

## Artifacts relies

- `logs/audit-report.json`
- `scripts/audit-exercises.mjs`
- `tests/model.test.mjs`
