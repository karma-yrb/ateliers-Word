# Audit Global - Atelier Excel

Date: 2026-06-15  
Perimetre: dataset Excel importe depuis Clic-Formation Tableur, qualite des contenus, detection fichiers/images/consignes.

## Synthese

Etat global: **import reussi et exploitable comme base de travail**. Le scraper a construit le catalogue depuis `https://www.clic-formation.net/tableur.html` puis enrichi les pages individuelles.

- Modules: **45**
- Exercices: **236**
- Pages scrapees OK: **236 / 236**
- Fichiers de travail manquants: **46** (19%)
- Images resultat manquantes: **63** (27%)
- Consignes courtes: **28** (12%)
- Etapes longues: **36** (15%)

## Lecture des risques

### Priorite 1 - Verifier les vrais trous de contenu

Les entrees ci-dessous cumulent plusieurs signaux faibles ou forts. Ce sont les meilleures candidates pour une verification manuelle rapide.

- `excel-ex-002` - Prise en main - Gérer les feuilles dans excel (sans fichier, sans resultat)
- `excel-ex-009` - Sélection - Exercice 1 (sans fichier, sans resultat)
- `excel-ex-010` - Sélection - Sélection multiple dans excel (sans fichier, sans resultat)
- `excel-ex-011` - Sélection - Sélectionner et dupliquer la cellule dans excel (sans fichier, sans resultat)
- `excel-ex-081` - Graphiques - Graphique Excel (sans fichier, sans resultat)
- `excel-ex-169` - Tableaux croisés dynamiques - Tableau Croisé Dynamique (sans fichier, sans resultat)
- `excel-ex-184` - Macro - Exercice 2 (sans fichier, sans resultat)
- `excel-ex-187` - Macro - Exercice 5 (sans fichier, sans resultat)
- `excel-ex-201` - UL11 Word - Electra (sans fichier, sans resultat)
- `excel-ex-202` - UL11 Word - Cité des concerts (sans fichier, sans resultat)
- `excel-ex-203` - UL11 Word - Union des commercants (sans fichier, sans resultat)
- `excel-ex-204` - UL11 Word - Novatix (sans fichier, sans resultat)
- `excel-ex-206` - UL11 Word - Credit Top (sans fichier, sans resultat)
- `excel-ex-207` - UL11 Word - Logique Bio (sans fichier, sans resultat)
- `excel-ex-212` - UL21 Excel - VANCOUVER (sans fichier, sans resultat)
- `excel-ex-213` - UL21 Excel - La Sue'DOISE (sans fichier, sans resultat)
- `excel-ex-215` - UL21 Excel - Sud Informatique (sans fichier, sans resultat)
- `excel-ex-218` - UL21 Excel - Centre Format (sans fichier, sans resultat)
- `excel-ex-219` - UL21 Excel - Parcelle (sans fichier, sans resultat)
- `excel-ex-226` - Cas Réservation Spectacle - Cas Réservation Spectacle (macros) (sans fichier, sans resultat)
- `excel-ex-001` - Prise en main - Prise en main Excel (sans fichier, 1 consigne(s))
- `excel-ex-005` - Saisir des données - Saisir des données dans Excel (sans fichier, 1 consigne(s))
- `excel-ex-006` - Saisir des données - Saisir des données dans Excel, construction d'un tabeau simple (sans fichier, 1 consigne(s))
- `excel-ex-020` - Mise en forme - Créer un Nouveau style de cellule (sans fichier, 1 consigne(s))
- `excel-ex-026` - Intégrer une image - Intégrer des illustrations via SMART-ART (sans resultat, 1 consigne(s))
- ... 6 autre(s) entree(s)

### Priorite 2 - Fichiers de travail manquants

Un fichier absent n'est pas toujours une erreur: certains exercices demandent de creer un classeur vide. Il faut surtout verifier les modules avec beaucoup de manques.

- `excel-ex-001` - Prise en main - Prise en main Excel (sans fichier, 1 consigne(s))
- `excel-ex-002` - Prise en main - Gérer les feuilles dans excel (sans fichier, sans resultat)
- `excel-ex-005` - Saisir des données - Saisir des données dans Excel (sans fichier, 1 consigne(s))
- `excel-ex-006` - Saisir des données - Saisir des données dans Excel, construction d'un tabeau simple (sans fichier, 1 consigne(s))
- `excel-ex-007` - Saisir des données - Saisir des données dans Excel et mise en couleur (sans fichier)
- `excel-ex-009` - Sélection - Exercice 1 (sans fichier, sans resultat)
- `excel-ex-010` - Sélection - Sélection multiple dans excel (sans fichier, sans resultat)
- `excel-ex-011` - Sélection - Sélectionner et dupliquer la cellule dans excel (sans fichier, sans resultat)
- `excel-ex-013` - Sélection - Sélectionner des cellules non-contigües dans excel (sans fichier)
- `excel-ex-014` - Mise en forme - Format et embelissement (sans fichier)
- `excel-ex-015` - Mise en forme - Format et embelissement (sans fichier)
- `excel-ex-020` - Mise en forme - Créer un Nouveau style de cellule (sans fichier, 1 consigne(s))
- `excel-ex-030` - Poignée de recopie - Poignée de recopie (sans fichier)
- `excel-ex-031` - Poignée de recopie - Poignée de recopie (sans fichier)
- `excel-ex-032` - Poignée de recopie - Poignée de recopie (sans fichier, 1 consigne(s))
- `excel-ex-033` - Poignée de recopie - Poignée de recopie (sans fichier, 1 consigne(s))
- `excel-ex-034` - Poignée de recopie - Poignée de recopie (sans fichier)
- `excel-ex-037` - Poignée de recopie - Liste personnalisable via le web (sans fichier)
- `excel-ex-081` - Graphiques - Graphique Excel (sans fichier, sans resultat)
- `excel-ex-100` - Format de cellule - Exercice pour mettre des valeurs au format monétaire dans Excel. Niveau Facile (sans fichier, 1 consigne(s))
- `excel-ex-109` - Référence absolue - Utilisation de la poignée de recopie et de la valeur absolue/relative (sans fichier)
- `excel-ex-112` - Référence absolue - Table de multiplication complète en deux tours de valeur absolue (sans fichier, 1 consigne(s))
- `excel-ex-169` - Tableaux croisés dynamiques - Tableau Croisé Dynamique (sans fichier, sans resultat)
- `excel-ex-183` - Macro - Réaliser une macro simple (sans fichier)
- `excel-ex-184` - Macro - Exercice 2 (sans fichier, sans resultat)
- `excel-ex-187` - Macro - Exercice 5 (sans fichier, sans resultat)
- `excel-ex-201` - UL11 Word - Electra (sans fichier, sans resultat)
- `excel-ex-202` - UL11 Word - Cité des concerts (sans fichier, sans resultat)
- `excel-ex-203` - UL11 Word - Union des commercants (sans fichier, sans resultat)
- `excel-ex-204` - UL11 Word - Novatix (sans fichier, sans resultat)
- ... 16 autre(s) entree(s)

### Priorite 3 - Images resultat manquantes

Toutes les pages ont une image d'enonce, mais 63 exercices n'ont pas d'image resultat detectee. Une partie peut venir de pages dont le resultat est implicite ou inclus dans l'image principale.

- `excel-ex-002` - Prise en main - Gérer les feuilles dans excel (sans fichier, sans resultat)
- `excel-ex-003` - Prise en main - Gérer l'affichage du classeur (sans resultat)
- `excel-ex-009` - Sélection - Exercice 1 (sans fichier, sans resultat)
- `excel-ex-010` - Sélection - Sélection multiple dans excel (sans fichier, sans resultat)
- `excel-ex-011` - Sélection - Sélectionner et dupliquer la cellule dans excel (sans fichier, sans resultat)
- `excel-ex-024` - Intégrer une image - Intégrer des illustrations, filigrane, pied de page et smart-art (sans resultat)
- `excel-ex-026` - Intégrer une image - Intégrer des illustrations via SMART-ART (sans resultat, 1 consigne(s))
- `excel-ex-046` - Faire une Addition - Addition (sans resultat)
- `excel-ex-073` - Calculer des pourcentages - Pourcentage (sans resultat)
- `excel-ex-079` - Calculer des pourcentages - Pourcentage (sans resultat)
- `excel-ex-081` - Graphiques - Graphique Excel (sans fichier, sans resultat)
- `excel-ex-082` - Graphiques - Graphique Excel (sans resultat, 1 consigne(s))
- `excel-ex-096` - Impression - Entête & pied de page (sans resultat)
- `excel-ex-099` - Format de cellule - Exercice pour manipuler de façon simple les formats de cellules dans excel. Niveau facile (sans resultat)
- `excel-ex-117` - Trier et filtrer - Trier et Filtrer une liste (sans resultat)
- `excel-ex-118` - Trier et filtrer - Trier et Filtrer une liste (sans resultat)
- `excel-ex-119` - Trier et filtrer - Trier et Filtrer une liste (sans resultat)
- `excel-ex-121` - Trier et filtrer - Exercice 7 (sans resultat)
- `excel-ex-122` - Trier et filtrer - Filtres avancés (sans resultat)
- `excel-ex-123` - Trier et filtrer - Exercice 6 (sans resultat)
- `excel-ex-125` - Trier et filtrer - Exercice 9 (sans resultat)
- `excel-ex-157` - Nommer une cellule - Exercice 5 (sans resultat)
- `excel-ex-158` - Nommer une cellule - Exercice 6 (sans resultat)
- `excel-ex-159` - Nommer une cellule - Exercice 7 (sans resultat)
- `excel-ex-160` - Nommer une cellule - Exercice 8 (sans resultat)
- `excel-ex-161` - Nommer une cellule - Exercice 9 (sans resultat)
- `excel-ex-162` - Tableaux croisés dynamiques - Exercie 1 : Tableau Croisé Dynamique (sans resultat)
- `excel-ex-163` - Tableaux croisés dynamiques - Tableau Croisé Dynamique (sans resultat)
- `excel-ex-164` - Tableaux croisés dynamiques - Tableau Croisé Dynamique (sans resultat)
- `excel-ex-165` - Tableaux croisés dynamiques - Tableau Croisé Dynamique (sans resultat)
- ... 33 autre(s) entree(s)

### Priorite 4 - Consignes courtes

Les consignes courtes ne sont pas forcement mauvaises, mais elles signalent souvent une page basee sur une image ou un fichier.

- `excel-ex-001` - Prise en main - Prise en main Excel (sans fichier, 1 consigne(s))
- `excel-ex-005` - Saisir des données - Saisir des données dans Excel (sans fichier, 1 consigne(s))
- `excel-ex-006` - Saisir des données - Saisir des données dans Excel, construction d'un tabeau simple (sans fichier, 1 consigne(s))
- `excel-ex-012` - Sélection - Sélection, suppression etinsertion de celulles dans excel (1 consigne(s))
- `excel-ex-016` - Mise en forme - Format automatique (1 consigne(s))
- `excel-ex-020` - Mise en forme - Créer un Nouveau style de cellule (sans fichier, 1 consigne(s))
- `excel-ex-026` - Intégrer une image - Intégrer des illustrations via SMART-ART (sans resultat, 1 consigne(s))
- `excel-ex-028` - Intégrer une image - Outils de mise en forme d'image (1 consigne(s))
- `excel-ex-032` - Poignée de recopie - Poignée de recopie (sans fichier, 1 consigne(s))
- `excel-ex-033` - Poignée de recopie - Poignée de recopie (sans fichier, 1 consigne(s))
- `excel-ex-039` - Faire une Addition - Addition (1 consigne(s))
- `excel-ex-049` - Faire une Soustraction - Soustraction (1 consigne(s))
- `excel-ex-074` - Calculer des pourcentages - Pourcentage (1 consigne(s))
- `excel-ex-077` - Calculer des pourcentages - Pourcentage (1 consigne(s))
- `excel-ex-082` - Graphiques - Graphique Excel (sans resultat, 1 consigne(s))
- `excel-ex-100` - Format de cellule - Exercice pour mettre des valeurs au format monétaire dans Excel. Niveau Facile (sans fichier, 1 consigne(s))
- `excel-ex-101` - Format de cellule - Exercice pour manipuler le format personnalisé: "jjjj". (1 consigne(s))
- `excel-ex-102` - Format de cellule - Format de cellule à insérer (1 consigne(s))
- `excel-ex-107` - Référence absolue - Exercice simple: comment mettre en place une valeur absolue dans une colonne - Série 1 (1 consigne(s))
- `excel-ex-112` - Référence absolue - Table de multiplication complète en deux tours de valeur absolue (sans fichier, 1 consigne(s))
- `excel-ex-145` - Lier des feuilles - Lier des feuilles de calculs (1 consigne(s))
- `excel-ex-147` - Lier des feuilles - Lier des feuilles de calculs & appareil photo (1 consigne(s))
- `excel-ex-222` - Cas Fiche Clients garage - Cas Fiche Clients garage (1 consigne(s))
- `excel-ex-223` - Cas Formulaire de saisie - Cas Formulaire de saisie (sans resultat, 1 consigne(s))
- `excel-ex-225` - Cas Calendrier perpétuel - Cas Calendrier perpétuel (ou presque) (1 consigne(s))
- `excel-ex-228` - Cas GANTT Simple - Cas diagramme de GANTT Simple (0 consigne(s))
- `excel-ex-230` - Cas SUD informatique - Cas SUD informatique (1 consigne(s))
- `excel-ex-232` - Cas Course Haut Caroux - Cas Course Haut Caroux (1 consigne(s))

## Modules les plus fragiles

| Module | Exercices | Sans fichier | Sans resultat | Consignes courtes |
| --- | ---: | ---: | ---: | ---: |
| Cas Formulaire de saisie | 1 | 0 | 1 | 1 |
| Cas Réservation Spectacle | 1 | 1 | 1 | 0 |
| UL11 Word | 8 | 6 | 8 | 0 |
| Sélection | 5 | 4 | 3 | 1 |
| UL21 Excel | 13 | 13 | 5 | 0 |
| Prise en main | 4 | 2 | 2 | 1 |
| Saisir des données | 4 | 3 | 0 | 2 |
| Tableaux croisés dynamiques | 9 | 1 | 9 | 0 |
| Macro | 5 | 3 | 2 | 0 |
| Cas Fiche Clients garage | 1 | 0 | 0 | 1 |
| Cas Calendrier perpétuel | 1 | 0 | 0 | 1 |
| Cas GANTT Simple | 1 | 0 | 0 | 1 |

## Hypotheses techniques

- Les fichiers de travail sont detectes via liens `.xlsx`, `.xls`, `.xlsm`, `.zip` et aussi `.docx` par compatibilite avec certains contenus mixtes.
- Le champ historique `docxUrl` est conserve temporairement comme champ technique de fichier de travail pour limiter le refactor UI.
- Les images resultat sont identifiees par section "resultat" ou par nom d'image; certaines pages Excel n'ont pas de section resultat explicite.

## Recommandations

1. Verifier manuellement les entrees de priorite 1.
2. Ameliorer le scraper pour detecter les liens de telechargement Joomla qui ne finissent pas directement par une extension fichier.
3. Renommer progressivement `docxUrl` en `workFileUrl` dans le modele commun.
4. Ajouter un rapport dedie `missing-work-files.md` si la correction manuelle devient volumineuse.
5. Extraire ensuite les scripts communs Word/Excel vers `packages/scraper-clic`.

## Audit runtime Word vs Excel - 2026-06-24

### Constats

- Le comportement de reprise apres rafraichissement et de changement d'utilisateur est centralise dans `packages/atelier-core/browser/controller.js`.
- Word et Excel embarquent pourtant chacun une copie locale du runtime commun dans `apps/*/js/core` puis une seconde copie dans `apps/*/app/js/core`.
- Excel avait un contrat HTML divergent sur le bouton principal de fichier de travail: `exercise-xlsx-btn` au lieu de `exercise-docx-btn`, alors que le runtime mutualise attend `exercise-docx-btn`.
- Cette divergence casse le contrat du socle partage et peut provoquer des erreurs de rendu ou des comportements partiels selon la page rechargee.

### Risques identifies

1. Une correction faite dans `packages/atelier-core` peut ne pas etre visible en production si `sync:app` ou `sync-browser-runtime` n'est pas relance.
2. Les copies multiples rendent les regressions silencieuses probables: un atelier peut "sembler" aligne alors que son HTML ou son CSS diverge encore.
3. Les noms techniques herites de Word (`docxUrl`, `exercise-docx-btn`) rendent l'intention moins claire pour Excel et favorisent les contournements locaux.

### Solutions proposees

1. Court terme: imposer un contrat DOM strict commun entre ateliers.
   Les ids attendus par `AtelierView` et `AtelierController` doivent etre identiques partout.
2. Court terme: ajouter des tests de contrat UI/DOM par atelier.
   Exemple: verifier les ids critiques utilises par le runtime partage.
3. Moyen terme: renommer le vocabulaire transverse.
   Remplacer progressivement `docxUrl` par `workFileUrl` et `exercise-docx-btn` par `exercise-workfile-btn` dans le core et dans les deux ateliers.
4. Moyen terme: supprimer les copies versionnees inutiles comme source primaire.
   Garder `packages/atelier-core/browser/*` comme seule source du runtime, puis regenerer les copies distribuees automatiquement.
5. Moyen terme: ajouter une verification CI qui compare `packages/atelier-core/browser/*` avec `apps/*/js/core/*` pour detecter toute derive.
