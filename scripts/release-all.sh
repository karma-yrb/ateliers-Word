#!/usr/bin/env bash
set -euo pipefail

COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-chore: prepare monorepo release}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[release:all] ERREUR: ce dossier n'est pas un depot Git."
  echo "[release:all] Ouvre le dossier clone du depot, ou initialise Git avant de publier."
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "[release:all] ERREUR: pas sur main (branche actuelle: $CURRENT_BRANCH)"
  exit 1
fi

npm run word:test
npm run excel:test

npm run word:sync:app
npm run excel:sync:app

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$COMMIT_MESSAGE"
fi

npm run word:release
npm run excel:release

git push --follow-tags

echo "[release:all] Publication monorepo terminee."
