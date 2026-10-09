#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo 'Open http://localhost:8000 in your browser.'
python3 -m http.server 8000
