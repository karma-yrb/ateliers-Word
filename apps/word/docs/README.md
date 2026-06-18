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

- `npm run build:data` -> regenere `data/exercises.js` a partir de `data/exercises.structured.json`.
- `npm test` -> execute les tests unitaires.
- `npm run release` / `npm run release:first` -> versioning `standard-version` (depot git requis).
- `npm run release:all` -> flux publication complet en Bash (tests + commit auto si worktree dirty + release + push tags).
- `npm run "lance pub"` -> alias de `npm run release:all`.
  - `release:all` reduit le blocage "worktree non propre" en committant les changements avant `standard-version`.
  - met a jour aussi le numero de version dans le header (`index.html`, `app/index.html`).
  - alimente la page `/releases` (`releases/release*.{json,js}` et copie `app/releases/`).
  - bloque la release si des commits non explicites sont detectes.
  - bloque aussi la release si le worktree git contient des changements en cours.

## Commits explicites (release)

- Format impose: `type(scope): description` (ou `type: description`).
- Exemples valides: `feat(auth): ...`, `fix(ui): ...`, `docs: ...`, `refactor(data): ...`.
- Marquage rupture: `feat(api)!: ...` ou footer `BREAKING CHANGE: ...`.

## Source de contenu

- La source editable des exercices Word est `data/exercises.structured.json`.
- Apres modification, lancer `npm run build:data` pour regenerer `data/exercises.js`.
- Le pipeline Word ne genere plus de fichiers de scraping, revision ou audit.
