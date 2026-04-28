# README - Version distribuable (app)

Cette version enregistre la progression dans un fichier utilisateur (pas en localStorage pour la progression).

Structure a copier sur le poste cible :
- C:\Exercices\AtelierWord\
  - index.html
  - styles.css
  - js\
  - data\
  - Docs\

Au premier lancement :
1. Une modale demande de choisir le dossier parent (souvent Documents).
2. L'utilisateur choisit un dossier existant (initiales) ou saisit de nouvelles initiales.
3. L'application cree automatiquement : Documents\<Initiales>\ProgressionAtelier\
4. Le fichier de progression est enregistre automatiquement ici :
   Documents\<Initiales>\ProgressionAtelier\progression-word.json

Notes :
- Le navigateur peut redemander l'autorisation d'acces au dossier selon ses regles de securite.
- Pour changer d'utilisateur, utiliser le bouton "Changer d'utilisateur" dans l'onglet Progression.
