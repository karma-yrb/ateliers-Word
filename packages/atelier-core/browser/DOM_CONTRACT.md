# Contrat DOM du runtime atelier-core

Ce document liste les éléments HTML minimaux attendus par le runtime partagé `atelier-core`.

## Navigation et structure

- `themes-affinity-list`
- `affinity-theme-list`
- `page-home`
- `page-themes`
- `page-affinity`
- `page-exercise`
- `page-progress`
- `page-profile`

## Identité utilisateur

- `header-user-badge`
- `header-user-menu`
- `header-user-switch-btn`
- `header-user-profile-btn`
- `progress-change-user-btn`
- `progress-reset-btn`
- `progress-reset-profile-btn`

## Fichier de travail

- `exercise-workfile-btn`
- `exercise-download-btn`
- `exercise-pick-workfile-btn`
- `exercise-open-workfile-btn`
- `exercise-workfile-status`

## Modales

- `user-setup-modal`
- `user-setup-status`
- `user-setup-saved-folders-wrap`
- `user-setup-saved-folders-select`
- `user-setup-pick-root-btn`
- `user-setup-firstname-input`
- `user-setup-cancel-btn`
- `user-setup-validate-btn`
- `save-reminder-modal`
- `save-reminder-message`
- `save-reminder-user-folder`
- `save-reminder-file-name`
- `save-reminder-existing-status`
- `save-reminder-cancel-btn`
- `save-reminder-continue-btn`

## Ordre de chargement des scripts partages

- `js/core/home.js`
- `js/core/themes.js`
- `js/core/persistence.js`
- `js/core/session.js`
- `js/core/workfile.js`
- `js/core/reminder-modal.js`
- `js/core/user-setup.js`
- `js/core/progress.js`
- `js/core/profile.js`
- `js/core/controller.js`

## Règle d'évolution

Toute modification d'un de ces IDs doit être répercutée dans `packages/atelier-core/browser/*`, synchronisée vers les apps, puis couverte par les tests de contrat HTML de chaque atelier.
