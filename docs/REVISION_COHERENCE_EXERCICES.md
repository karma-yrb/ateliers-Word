# Revision complete - Coherence des exercices

Date: 27 avril 2026  
Base analysee: `data/exercises.enriched.json` (213 exercices)

## Execution des vagues

Les 3 vagues ont ete appliquees de bout en bout via `npm run revise:data`.

### Vague 1 - Corrections bloquantes
- `ex-182` et `ex-186`: docx de secours renseignes (liens de telechargement Clic Formation).
- `ex-001`: image resultat completee (meme image que l'enonce).
- Module vide `m10` retire du dataset (31 modules actifs restants).

### Vague 2 - Reecriture pedagogique
- 34 exercices a consignes courtes reecrits au format standard:
  - ouverture du support,
  - objectif de production,
  - action Word contextualisee,
  - verification sur resultat attendu,
  - validation finale.

### Vague 3 - Lissage global
- Decoupage des etapes trop longues.
- Harmonisation des titres ambigus avec contexte module/numero.
- Uniformisation de la terminologie (fichier de travail, resultat attendu, validation).

## Resultats avant / apres

Source: `logs/revision-report.json` + `logs/audit-report.json`

- Modules: `32 -> 31`
- Exercices: `213 -> 213`
- Exercices a consignes courtes (< 2 etapes): `34 -> 0`
- Exercices avec etape trop longue (> 220 caracteres): `11 -> 0`
- Exercices sans docx: `2 -> 0`
- Exercices sans image resultat: `1 -> 0`
- Modules sans exercice: `1 -> 0`

## Definition retenue d'un exercice coherent

Un exercice est considere coherent si:

1. Il contient au minimum 3 etapes actionnables.
2. Les etapes sont lisibles et decoupees.
3. Le resultat attendu est verifiable.
4. Le support est present (docx ou equivalent) ou une consigne explicite de creation est fournie.
5. Le niveau et le contenu restent alignes.

## Suivi recommande

- Executer chaque semaine:
  - `npm run revise:data`
  - `npm run build:data`
  - `npm run audit:data`
  - `npm test`
- Surveiller en priorite:
  - retour d'usage formateur sur la clarte des consignes,
  - ecarts entre donnees `data/` et copie `app/data/`.
