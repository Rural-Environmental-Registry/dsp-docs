#!/usr/bin/env bash
# Live reload de um idioma (sem troca no menu — use ../start-docs.sh para os dois).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

locale="${1:-pt-br}"
shift || true

case "$locale" in
  pt-br | en) ;;
  *)
    echo "Uso: $0 [pt-br|en] [argumentos do zensical serve...]" >&2
    exit 1
    ;;
esac

if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi

chmod +x scripts/docs-pages-base-url.sh scripts/resolve-zensical-config.sh
CFG="$(./scripts/resolve-zensical-config.sh "zensical.${locale}.toml")"

exec zensical serve -f "$CFG" "$@"
