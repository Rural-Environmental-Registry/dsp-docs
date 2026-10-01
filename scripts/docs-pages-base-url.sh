#!/usr/bin/env bash
# Public base URL of the deployed docs (no trailing slash), for GitHub Pages project sites.
# Override with DOCS_PAGES_BASE (e.g. custom domain) when needed.
set -euo pipefail

if [[ -n "${DOCS_PAGES_BASE:-}" ]]; then
  printf '%s' "${DOCS_PAGES_BASE%/}"
  exit 0
fi

if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  owner="${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPOSITORY%%/*}}"
  repo="${GITHUB_REPOSITORY#*/}"
  printf 'https://%s.github.io/%s' "$owner" "$repo"
  exit 0
fi

# Local builds: no canonical host (relative paths only in output).
printf '%s' "http://127.0.0.1:8000"
