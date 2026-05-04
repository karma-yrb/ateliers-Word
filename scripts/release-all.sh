#!/usr/bin/env bash
set -euo pipefail

COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-chore: prepare release}"

npm run test

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$COMMIT_MESSAGE"
fi

npm run release
git push --follow-tags

echo "[release:all] Publication terminee."

