#!/bin/sh

set -e

# node_modules is a volume: install what the lockfile says on every start, as
# the Ruby services run `bundle`, so a dependency change needs no rebuild.
pnpm install --frozen-lockfile --config.confirmModulesPurge=false
pnpm svelte-kit sync
pnpm run build:parser

exec "$@"
