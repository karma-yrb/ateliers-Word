#!/usr/bin/env bash
set -euo pipefail

COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-chore: prepare release}"

# Vérifier qu'on est sur main avant tout
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "[release:all] ERREUR: pas sur main (branche actuelle: $CURRENT_BRANCH)"
  exit 1
fi

npm run test

# Synchroniser app/ depuis les sources avant de committer
npm run sync:app

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$COMMIT_MESSAGE"
fi

npm run release
git push --follow-tags

echo "[release:all] Publication terminee."