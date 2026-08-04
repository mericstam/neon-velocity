#!/usr/bin/env sh
# Install dependencies and run the app. Linux/macOS entry point.
#   ./run.sh           -> dev server
#   ./run.sh build     -> production build
#   ./run.sh test      -> test suite
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "node not found on PATH — install Node.js 20.19+ or 22.12+ first: https://nodejs.org" >&2
  exit 1
fi

exec node "$(dirname "$0")/scripts/start.mjs" "$@"
