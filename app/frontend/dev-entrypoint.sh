#!/bin/sh

# Reconcile node_modules with the (bind-mounted, live) lockfile.
# The node_modules volume is only seeded from the image on first creation and is
# never re-synced by later image rebuilds, so do it here on every start. This is a
# fast no-op when the lockfile is unchanged.
pnpm install --frozen-lockfile --prefer-offline

mkdir -p /app/frontend/build/plugins

# Remove old symlinks from previous runs
find /app/frontend/build/plugins -maxdepth 1 -type l -delete

# Create symlinks for all plugins
for plugin_dir in /app/plugins/*; do
  [ -d "$plugin_dir" ] && ln -s "$plugin_dir" /app/frontend/build/plugins/
done

for plugin_dir in /app/plugins_dev/plugins/*; do
  [ -d "$plugin_dir" ] && ln -s "$plugin_dir" /app/frontend/build/plugins/
done

pnpm svelte-kit sync
pnpm run build:parser

exec "$@"
