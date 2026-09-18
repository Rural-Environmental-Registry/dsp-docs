#!/bin/bash

cd "$(dirname "$0")" || exit 1

URL="http://127.0.0.1:8000/pt-br/"
PORT=8000

stop_server() {
  local stopped=0
  if pkill -x zensical 2>/dev/null; then
    echo "Servidor Zensical encerrado."
    stopped=1
  fi
  if pkill -f "python3 -m http.server ${PORT}" 2>/dev/null || pkill -f "http.server ${PORT}" 2>/dev/null; then
    echo "Servidor local de documentação encerrado."
    stopped=1
  fi
  if (( stopped )); then
    return 0
  fi
  return 1
}

if [[ "${1:-}" == "--stop" ]]; then
  stop_server || echo "Nenhum servidor na porta ${PORT}."
  exit 0
fi

stop_server || true

if [ -f .venv/bin/activate ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi

chmod +x scripts/build-site.sh

echo "Gerando site (pt-br + en)..."
if ! ./scripts/build-site.sh; then
  echo "Erro no build da documentação. Verifique a saída acima." >&2
  exit 1
fi

(
  for i in $(seq 1 60); do
    curl -sf -o /dev/null "$URL" && break
    sleep 0.5
  done
  command -v librewolf >/dev/null && librewolf "$URL"
) &

echo "Servindo em ${URL} (troca de idioma: /pt-br/ e /en/). Parar: ./start-docs.sh --stop"
cd site || exit 1
exec python3 -m http.server "$PORT" --bind 127.0.0.1
