#!/usr/bin/env bash
# Runs the installer the way a customer does, unattended, and checks the result.
#
#   test-installer.sh install <bundle dir>
#       A fresh install from an unpacked bundle (or deploy/compose/ itself).
#
#   test-installer.sh upgrade <from version> <to version> <release dir>
#       Installs <from version> from its published bundle, then upgrades it to
#       <to version> with --upgrade. <release dir> holds the new release's files
#       as build-bundle.sh writes them; they are served locally, so the upgrade
#       works before the release is published.
#
# Either way every service must answer through nginx and report the version
# installed. The install is removed afterwards, volumes included.
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
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

say "Passed"
