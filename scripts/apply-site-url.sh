#!/usr/bin/env bash
# Deprecated wrapper: use resolve-zensical-config.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/resolve-zensical-config.sh" zensical.pt-br.toml
"$root/scripts/resolve-zensical-config.sh" zensical.en.toml
base="$("$root/scripts/docs-pages-base-url.sh")"
echo "site_url base: ${base}"
