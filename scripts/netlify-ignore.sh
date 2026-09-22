#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CACHED_COMMIT_REF:-}" || -z "${COMMIT_REF:-}" ]]; then
  exit 1
fi

if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- \
  . \
  ':(exclude)supabase/**' \
  ':(exclude).github/**' \
  ':(exclude)agents.md' \
  ':(exclude)readme.md' \
  ':(exclude)sitemap.xml'
then
  exit 0
fi

exit 1
