#!/bin/sh

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

pnpm install --force
pnpm svelte-kit sync
pnpm run build:parser

exec "$@"
