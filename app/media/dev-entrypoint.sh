#!/bin/sh

set -e

echo "Environment: $APP_ENVIRONMENT"

echo "Setting local gems ..."
bundle config set local.verse-core /app/common/gems/verse-core
bundle config set local.verse-http /app/common/gems/verse-http
bundle config set local.verse-jsonapi /app/common/gems/verse-jsonapi
bundle config set local.verse-sequel /app/common/gems/verse-sequel
bundle config set local.verse-schema /app/common/gems/verse-schema

echo "Installing gems ..."
bundle config set force_ruby_platform true
bundle install --jobs 20 --retry 5

# run passed commands
bundle exec ${@}
