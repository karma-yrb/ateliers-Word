Atelier Word (MVC)

But
- Application autonome pour les utilisateurs.
- Parcours complet: theme -> exercice -> etapes -> progression.
- Le site externe n'est utilise que pour les assets (docx, images).

Structure
- index.html
- styles.css
- js/model.js
- js/view.js
- js/controller.js
- js/storage.js
- js/app.js
- data/exercises.enriched.json
- data/exercises.js
- scripts/
- tests/

Utilisation
1) Ouvrir index.html dans le navigateur.
2) Aller sur Themes et lancer un exercice.
3) Suivre les etapes, telecharger le .docx si besoin, comparer avec les images.
4) Marquer l'exercice comme fait.
5) Voir la courbe dans Progression.
6) Aller dans Profil:
   - "Reinitialiser progression" efface uniquement l'avancement des exercices.
   - "Reinitialiser profil local" oublie le prenom et le dossier utilisateur memorise sur l'appareil.

Scripts npm
- npm run scrape:data -> enrichit data/exercises.enriched.json et les logs de scraping.
- npm run revise:data -> applique les vagues de revision pedagogique et structurelle.
- npm run build:data -> regenere data/exercises.js pour le navigateur.
- npm run audit:data -> genere logs/audit-report.json.
- npm run repair:encoding -> corrige automatiquement les chaines en mojibake dans les donnees.
- npm run validate:encoding -> verifie parse JSON/JS, absence BOM et absence de mojibake.
- npm test -> lance les tests unitaires.
- npm run release / npm run release:first -> versioning standard-version (necessite un depot git).
  - met a jour automatiquement la version dans `package*.json`, `CHANGELOG.md`, `index.html`, `app/index.html`.
  - met a jour automatiquement la page `releases/index.html` via `releases/releases.json` (+ copie `app/releases/`).
  - valide les commits depuis le dernier tag (Conventional Commits obligatoires).
  - bloque la release si le worktree git n'est pas propre (publication ciblee uniquement).

Conventions de commit (obligatoire pour release)
- Format: `type(scope): description` (ou `type: description`).
- Types recommandes: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`.
- Exemple: `feat(profile): ajouter la reconfiguration utilisateur`.
- Si changement incompatible: ajouter `!` ou `BREAKING CHANGE:` dans le body.

Notes
- La progression est conservee dans le dossier utilisateur via File System Access API.
- Le versioning automatique est configure via standard-version.
