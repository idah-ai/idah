#!/usr/bin/env bash
# Runs the installer the way a customer does, unattended, and checks the result.
#
#   test-installer.sh install <bundle dir>
#       A fresh install from an unpacked bundle (or deploy/compose/ itself).
#
#   test-installer.sh retry <bundle dir>
#       A fresh install that fails part-way (its PostgreSQL will not start),
#       then ./install.sh run again once the cause is gone: it must carry on
#       and finish, and a third run must refuse to install over it.
#
#   test-installer.sh upgrade <from version> <to version> <release dir>
#       Installs <from version> from its published bundle, then upgrades it to
#       <to version> with --upgrade. <release dir> holds the new release's files
#       as build-bundle.sh writes them; they are served locally, so the upgrade
#       works before the release is published.
#
# Every scenario checks that every service answers through nginx and reports
# the version installed. The install is removed afterwards, volumes included.
#
# Images come from IDAH_IMAGE_PREFIX (default: the published ones). For images
# built locally, tag them <prefix><image>:<version> and set the prefix.
# IDAH_TEST_HTTP_PORT picks the HTTP port (default 8080); HTTPS and the local
# release server take the next two.

set -euo pipefail

port=${IDAH_TEST_HTTP_PORT:-8080}
services="iam dataset media setting notification sync audit"
published=https://github.com/idah-ai/idah/releases/download

say() { printf '\n### %s\n' "$*"; }
fail() { echo "FAILED: $*" >&2; exit 1; }

work=$(mktemp -d)
server=""

cleanup() {
  local status=$?
  if [ -f "$work/install/compose.yml" ]; then
    if [ $status -ne 0 ] && [ -n "$(cd "$work/install" && docker compose ps -aq 2> /dev/null)" ]; then
      say "Logs of the failed install"
      (cd "$work/install" && docker compose ps -a && docker compose logs --tail 60) || true
    fi
    (cd "$work/install" && docker compose down -v --remove-orphans > /dev/null 2>&1) || true
  fi
  [ -z "$server" ] || kill "$server" 2> /dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

# Answers every question from the environment instead of a terminal.
run_installer() {
  (cd "$work/install" \
    && IDAH_URL="http://localhost:$port" IDAH_HTTP_PORT="$port" IDAH_HTTPS_PORT="$((port + 1))" \
       ./install.sh --yes --admin-email admin@idah.test)
}

# Every service answers through nginx and reports <version>.
check() { # <version>
  say "Checking the running install"
  local svc body reported
  for svc in $services; do
    body=$(curl -fsS --max-time 10 "http://localhost:$port/api/v1/$svc/healthcheck") \
      || fail "$svc does not answer through nginx"
    reported=$(printf '%s' "$body" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
    [ "$reported" = "$1" ] || fail "$svc reports version '$reported', expected '$1'"
    printf '   %-13s %s\n' "$svc" "$reported"
  done
  curl -fsS --max-time 10 -o /dev/null "http://localhost:$port/" || fail "the frontend does not answer"
  echo "   frontend      ok"
}

case "${1:-}" in
  install)
    bundle=${2:?usage: test-installer.sh install <bundle dir>}
    version=${IDAH_VERSION:-$(sed -n 's/^release_version="\(.*\)"$/\1/p' "$bundle/install.sh")}
    [ -n "$version" ] || fail "set IDAH_VERSION, or give a bundle whose installer carries a release"

    say "Installing $version"
    mkdir "$work/install"
    cp -R "$bundle/." "$work/install/"
    IDAH_VERSION=$version run_installer
    check "$version"
    ;;

  retry)
    bundle=${2:?usage: test-installer.sh retry <bundle dir>}
    version=${IDAH_VERSION:-$(sed -n 's/^release_version="\(.*\)"$/\1/p' "$bundle/install.sh")}
    [ -n "$version" ] || fail "set IDAH_VERSION, or give a bundle whose installer carries a release"

    say "Installing $version with a PostgreSQL that will not start"
    mkdir "$work/install"
    cp -R "$bundle/." "$work/install/"
    printf 'services:\n  postgres:\n    entrypoint: ["sh", "-c", "exit 1"]\n' > "$work/install/compose.override.yml"
    if IDAH_VERSION=$version run_installer; then fail "the install should have failed"; fi
    grep -q '^IDAH_INSTALL_STARTED_AT=.' "$work/install/.env" || fail "the failed install is not marked as started"
    if grep -q '^IDAH_INSTALLED_AT=' "$work/install/.env"; then fail "the failed install is marked as finished"; fi

    say "Running it again after the fix"
    rm "$work/install/compose.override.yml"
    IDAH_VERSION=$version run_installer
    check "$version"
    grep -q '^IDAH_INSTALLED_AT=.' "$work/install/.env" || fail "the install is not marked as finished"

    say "Running it a third time"
    if run_installer > "$work/third.log" 2>&1; then fail "the installer ran over a finished install"; fi
    grep -q "already installed" "$work/third.log" || { cat "$work/third.log"; fail "refused for the wrong reason"; }
    echo "   refused: already installed"
    ;;

  upgrade)
    from=${2:?usage: test-installer.sh upgrade <from> <to> <release dir>}
    to=${3:?usage: test-installer.sh upgrade <from> <to> <release dir>}
    release=${4:?usage: test-installer.sh upgrade <from> <to> <release dir>}

    # Both releases served from one place: the published one, and the new one.
    say "Serving $from (published) and $to (local)"
    mkdir -p "$work/releases/v$from" "$work/releases/v$to"
    curl -fsSL -o "$work/releases/v$from/idah-$from.tar.gz" "$published/v$from/idah-$from.tar.gz"
    curl -fsSL -o "$work/releases/v$from/SHA256SUMS" "$published/v$from/SHA256SUMS"
    cp "$release/idah-$to.tar.gz" "$release/SHA256SUMS" "$work/releases/v$to/"
    serve_port=$((port + 2))
    python3 -m http.server "$serve_port" --bind 127.0.0.1 --directory "$work/releases" > /dev/null 2>&1 &
    server=$!
    for _ in $(seq 1 20); do curl -fs -o /dev/null "http://127.0.0.1:$serve_port/" && break; sleep 0.5; done
    export IDAH_RELEASE_BASE="http://127.0.0.1:$serve_port"

    say "Installing $from"
    mkdir "$work/install"
    tar -xzf "$work/releases/v$from/idah-$from.tar.gz" --strip-components=1 -C "$work/install"
    IDAH_VERSION=$from IDAH_IMAGE_PREFIX=ghcr.io/idah-ai/idah- run_installer
    check "$from"

    say "Upgrading to $to"
    sed -i.bak "s/^IDAH_VERSION=.*/IDAH_VERSION=$to/" "$work/install/.env"
    rm -f "$work/install/.env.bak"
    if [ -n "${IDAH_IMAGE_PREFIX:-}" ]; then
      grep -v '^IDAH_IMAGE_PREFIX=' "$work/install/.env" > "$work/env"
      echo "IDAH_IMAGE_PREFIX=$IDAH_IMAGE_PREFIX" >> "$work/env"
      mv "$work/env" "$work/install/.env"
    fi
    (cd "$work/install" && ./install.sh --upgrade --yes)
    check "$to"
    ;;

  *)
    sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

say "Passed"
