#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required. Install it from https://nodejs.org/"
    read -r _
    exit 1
fi

exec node scripts/manager.js "$@"
