# Ateliers Bureautique

Monorepo des ateliers bureautiques.

## Applications

- `apps/word` : atelier Word actuel, versionne independamment.
- `apps/excel` : atelier Excel initialise avec un dataset temporaire minimal.

## URLs publiees

- `/word/` : atelier Word.
- `/excel/` : atelier Excel.
- `/` : choix de l'atelier.

## Commandes

Depuis la racine :

- `npm run word:test`
- `npm run word:build:data`
- `npm run word:sync:app`
- `npm run word:release`
- `npm run word:release:all`
- `npm run excel:test`
- `npm run excel:build:data`
- `npm run excel:sync:app`
- `npm run excel:audit:data`

Depuis `apps/word` ou `apps/excel`, les commandes locales restent disponibles (`npm test`, `npm run build:data`, etc.).

Pour Word, le flux de donnees a ete simplifie :

- la source editable est `apps/word/data/exercises.structured.json`
- `npm run word:build:data` regenere `apps/word/data/exercises.js`
- les anciens scripts Word de scraping, revision et audit ont ete retires

## Organisation cible

- `apps/*` : applications finales (`word`, `excel`, puis `powerpoint`, etc.).
- `packages/atelier-core` : scripts communs (`build-data`, `sync-app`, validation encodage) et runtime navigateur partagé (`model`, `storage`, `view`, `controller`) par les ateliers.
- `packages/*` : autres codes communs à extraire progressivement.
