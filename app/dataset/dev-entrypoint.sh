#!/bin/sh

set -e

echo "Environment: $APP_ENVIRONMENT"

bundle
bundle exec rake db:setup db:migrate
bundle exec ${@}