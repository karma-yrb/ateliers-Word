# Ateliers Bureautique

Monorepo des ateliers bureautiques.

## Applications

- `apps/word` : atelier Word actuel, versionne independamment.
- `apps/excel` : atelier Excel initialise avec un dataset temporaire minimal.

## Commandes

Depuis la racine :

- `npm run word:test`
- `npm run word:build:data`
- `npm run word:sync:app`
- `npm run word:audit:data`
- `npm run word:release`
- `npm run word:release:all`
- `npm run excel:test`
- `npm run excel:build:data`
- `npm run excel:sync:app`
- `npm run excel:audit:data`

Depuis `apps/word` ou `apps/excel`, les commandes locales restent disponibles (`npm test`, `npm run build:data`, etc.).

## Organisation cible

- `apps/*` : applications finales (`word`, `excel`, puis `powerpoint`, etc.).
- `packages/*` : code commun extrait progressivement.

