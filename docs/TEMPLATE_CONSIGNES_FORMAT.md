# Template consignes de formatage

## Regle d'interpretation

- Quand tu ecris `ex-010 > texte a modifier`, cela signifie:
  - cible = exercice `ex-010`
  - action = modifier les lignes de consignes de cet exercice
  - ce n'est pas une ligne a afficher dans l'exercice
- Donc on ne doit jamais ajouter une consigne litterale du type `Texte a modifier.`

## Template standard

Utiliser ce format uniquement si la structure est clairement de la mise en forme ligne par ligne:

1. `Element 1 : "Police", taille: N, [styles], [couleur], [surligne], [alignement].`
2. `Element 2 : "Police", taille: N, [styles], [couleur], [surligne], [alignement].`
3. `Element 3 : ...`

## Regle d'application

- Appliquer automatiquement le template uniquement quand la structure est explicite:
  - plusieurs lignes nommees (`Texte 1`, `Titre`, `Date`, etc.)
  - plusieurs attributs de mise en forme (police, taille, style, alignement, couleur...)
- En cas de doute, ne pas convertir automatiquement et remonter le numero d'exercice pour revision manuelle.

