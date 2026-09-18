#!/usr/bin/env bash
# Writes a zensical config with __DOCS_PAGES_BASE__ replaced (does not modify sources).
# Output lives in the repo root so docs_dir/site_dir stay valid for zensical.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <zensical.pt-br.toml|zensical.en.toml>" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
source_file="$1"
if [[ "$source_file" != /* ]]; then
  source_file="$root/$source_file"
fi

if [[ ! -f "$source_file" ]]; then
  echo "Config not found: $source_file" >&2
  exit 1
fi

base="$("$root/scripts/docs-pages-base-url.sh")"
name="$(basename "$source_file" .toml)"
out_file="$root/.zensical-build.${name}.toml"

sed "s|__DOCS_PAGES_BASE__|${base}|g" "$source_file" > "$out_file"
printf '%s\n' "$out_file"
