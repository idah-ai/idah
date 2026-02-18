#!/bin/sh

pnpm install
pnpm svelte-kit sync
pnpm run build:idah-video
pnpm run build:parser

exec "$@"