#!/bin/sh
set -eu

dependency_hash="$(cat package.json package-lock.json | sha256sum | awk '{print $1}')"
hash_file="node_modules/.dependency-hash"

if [ ! -f "$hash_file" ] || [ "$(cat "$hash_file")" != "$dependency_hash" ]; then
    npm ci
    printf '%s\n' "$dependency_hash" > "$hash_file"
fi

exec "$@"
