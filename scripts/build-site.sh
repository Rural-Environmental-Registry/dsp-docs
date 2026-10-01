#!/usr/bin/env bash
# Build completo: raiz + pt-br + en (mesmo layout do CI).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

chmod +x scripts/docs-pages-base-url.sh scripts/resolve-zensical-config.sh

PT_CFG="$(./scripts/resolve-zensical-config.sh zensical.pt-br.toml)"
EN_CFG="$(./scripts/resolve-zensical-config.sh zensical.en.toml)"

rm -rf site && mkdir -p site
cp static/root/index.html site/index.html
zensical build -f "$PT_CFG" --clean
zensical build -f "$EN_CFG"
