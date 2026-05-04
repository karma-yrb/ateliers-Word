# Documentation installation et exploitation

## Structure

- `word-atelier/`
  - `index.html`
  - `js/`
  - `data/`
  - `styles.css`
  - `scripts/`
  - `tests/`
  - `docs/`
- `Documents/[UTILISATEUR]/`
  - `ProgressionAtelier/progression-word.json`
  - `ProgressionAtelier/profil-utilisateur.json`

## Installation

1. Copier le dossier `word-atelier/` complet sur le poste.
2. Ouvrir `index.html` dans un navigateur recent (Edge/Chrome).
3. Au premier lancement:
   - choisir le dossier utilisateur,
   - saisir le prenom,
   - valider.

## Gestion utilisateur

- `Changer d'utilisateur`: recharge un autre dossier utilisateur.
- `Reinitialiser progression`: remet a zero uniquement l'avancement.
- `Reinitialiser profil local`: oublie le prenom et le dossier memorise sur ce poste.

## Commandes de maintenance

- `npm run scrape:data` -> enrichit `data/exercises.enriched.json`.
- `npm run revise:data` -> applique les vagues 1 a 3 de revision (docx/images/contenu/coherence).
- `npm run build:data` -> regenere `data/exercises.js`.
- `npm run audit:data` -> genere `logs/audit-report.json`.
- `npm test` -> execute les tests unitaires.
- `npm run release` / `npm run release:first` -> versioning `standard-version` (depot git requis).
  - met a jour aussi le numero de version dans le header (`index.html`, `app/index.html`).
  - alimente la page `/releases` (`releases/release*.{json,js}` et copie `app/releases/`).
  - bloque la release si des commits non explicites sont detectes.
  - bloque aussi la release si le worktree git contient des changements en cours.

## Commits explicites (release)

- Format impose: `type(scope): description` (ou `type: description`).
- Exemples valides: `feat(auth): ...`, `fix(ui): ...`, `docs: ...`, `refactor(data): ...`.
- Marquage rupture: `feat(api)!: ...` ou footer `BREAKING CHANGE: ...`.

## Documents d'audit

- `docs/AUDIT_GLOBAL.md`
- `docs/REVISION_COHERENCE_EXERCICES.md`
- `logs/audit-report.json`
- `logs/revision-report.json`
