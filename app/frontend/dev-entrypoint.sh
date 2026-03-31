#!/bin/sh

mkdir -p /app/frontend/build/plugins

# Merge plugins and plugins_dev into frontend build
ln -s /app/plugins/* /app/frontend/build/plugins/
ln -s /app/plugins_dev/plugins/* /app/frontend/build/plugins/

pnpm install
pnpm svelte-kit sync
pnpm run build:parser

exec "$@"