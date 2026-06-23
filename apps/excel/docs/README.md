# Atelier Excel

Application Excel initialisee depuis le template Word.

## Source cible

- https://www.clic-formation.net/tableur.html

## Commandes

- `npm run excel:test` depuis la racine
- `npm test` depuis `apps/excel`
- `npm run excel:build:data` regenere `data/exercises.js` a partir de `data/exercises.structured.json`
- `npm run excel:sync:app` copie l'application et les donnees vers `app/`

## Source de contenu

- La source editable des exercices Excel est `data/exercises.structured.json`.
- Apres modification, lancer `npm run excel:build:data` pour regenerer `data/exercises.js`.
