Atelier Excel (MVC)

Application pedagogique Excel issue du template Word.

Source cible des exercices :
https://www.clic-formation.net/tableur.html

Commandes principales depuis la racine :
- npm run excel:test
- npm run excel:build:data
- npm run excel:sync:app

Source editable des exercices :
- data/exercises.structured.json

Flux standard :
- modifier data/exercises.structured.json
- npm run excel:build:data -> regenere data/exercises.js pour le navigateur
- npm run excel:sync:app -> recopie les donnees vers app/data
