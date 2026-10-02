#!/bin/sh

pnpm svelte-kit sync
pnpm run build:parser

exec "$@"
