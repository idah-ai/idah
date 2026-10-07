#!/usr/bin/env bash
#
# Install IDAH: generates every secret, prepares the databases, creates the
# accounts and starts the stack.
#
#   ./install.sh
#
# Settings come from .env, created from .env.example if missing. By default
# IDAH runs its own PostgreSQL and Redis. To change anything, create .env first
# (cp .env.example .env), edit it, then run this; see README.md. Values already
# in .env are kept: only empty secrets are generated.
#
# A setting .env leaves empty can also come from the environment, and is then
# written into .env:
#
#   IDAH_VERSION=0.0.0-local IDAH_IMAGE_PREFIX=idah- ./install.sh
#
# It asks for the public URL (unless IDAH_URL is set) and the administrator's
# email. Run on its own (curl ... | bash), it first asks where to install:
# the current directory by default, or IDAH_DIR.
#
#   --admin-email EMAIL    administrator login, instead of asking
#   --admin-name NAME      default Administrator
#   -y, --yes              ask nothing; defaults for anything not set
#   --encode               percent-encode a password for REDIS_URL, then exit
#
# Two flags continue an existing install. Both keep .env, its secrets and the
# signing key, and neither drops a database.
#
#   --provision            after pointing .env at your own PostgreSQL: create
#                          the databases and schema there. Refuses a database
#                          that already has IDAH data. Data in the bundled
#                          database is copied over first; its volume is left
#                          untouched, so you can go back.
#   --start-empty          with --provision: copy nothing, start with empty
#                          databases and a new administrator password.
#   --upgrade              after changing IDAH_VERSION: take that release's
#                          files, run its migrations and restart. Keeps every
#                          row and account. Refuses a database with no IDAH data.
#
# Requires docker, docker compose, openssl and curl.
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"

env_file=.env
keys_dir=config/keys
certs_dir=config/certs
services="iam dataset media setting notification sync audit"
# Every service runs the service image, except media.
images="service media frontend"
default_prefix=ghcr.io/idah-ai/idah-

# Set by the release build (build-bundle.sh).
release_version=""

admin_email=""; admin_name="Administrator"
assume_yes=false; encode=false; provision=false; upgrade=false; start_empty=false

# After a curl download the user is not in the install folder. in_dir puts a
# cd in front of the commands errors suggest, so they run as shown; an error
# without one still says where the install is.
downloaded_to=""; in_dir=""
die() {
  echo "error: $*" >&2
  case "$*" in
    ""|*"cd $downloaded_to "*) ;;
    *) [ -z "$downloaded_to" ] || printf '\n       IDAH was downloaded to %s. Run these from there:\n           cd %s\n' "$downloaded_to" "$downloaded_to" >&2 ;;
  esac
  exit 1
}
say() { printf '\n== %s\n' "$*"; }

# Kept for the newer installer an upgrade hands over to.
args=("$@")

while [ $# -gt 0 ]; do
  case "$1" in
    --admin-email) admin_email=${2:?}; shift 2 ;;
    --admin-name) admin_name=${2:?}; shift 2 ;;
    -y|--yes) assume_yes=true; shift ;;
    --encode) encode=true; shift ;;
    --provision) provision=true; shift ;;
    --upgrade) upgrade=true; shift ;;
    --start-empty) start_empty=true; shift ;;
    -h|--help)
      [ -r "$self" ] || die "--help reads this file, which is not on disk when the installer arrives through a pipe.
       Download it first: curl -fsSLO ${IDAH_RELEASE_BASE:-https://github.com/idah-ai/idah/releases/latest/download}/install.sh"
      awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$self"; exit 0 ;;
    *) die "unknown argument: $1 (settings go in .env; see --help)" ;;
  esac
done

ask() { # <prompt> <default>
  local answer
  if $assume_yes; then echo "${2:-}"; return; fi
  if [ ! -t 0 ] && { : < /dev/tty; } 2> /dev/null; then
    # Piped (curl ... | bash): stdin is the script, so read the terminal.
    read -r -p "$1${2:+ [$2]}: " answer < /dev/tty
  else
    # A terminal, or answers piped in one per line.
    read -r -p "$1${2:+ [$2]}: " answer
  fi
  echo "${answer:-${2:-}}"
}

# Percent-encodes every byte outside the RFC 3986 unreserved set. Goes through
# od, since bash's printf "'c" mangles bytes above 127.
urlencode() {
  local out="" h
  for h in $(printf '%s' "$1" | od -An -v -tx1); do
    case "$h" in
      3[0-9]|4[1-9a-f]|5[0-9a]|6[1-9a-f]|7[0-9a]|2d|2e|5f|7e) out="$out$(printf "\\x$h")" ;;
      *) out="$out%$(printf '%s' "$h" | tr 'a-f' 'A-F')" ;;
    esac
  done
  printf '%s' "$out"
}

if $encode; then
  # Read silently: keeps the password off the screen and out of the history.
  if [ -t 0 ]; then IFS= read -r -s -p "Password to encode: " value; echo >&2; else IFS= read -r value; fi
  urlencode "$value"; echo
  exit 0
fi

# --- checks ----------------------------------------------------------------

for tool in docker openssl curl; do
  command -v "$tool" > /dev/null || die "$tool is required but not installed"
done
docker compose version > /dev/null 2>&1 || die "docker compose (v2) is required"
docker info > /dev/null 2>&1 || die "cannot talk to the Docker daemon; is it running?"

# --- the release's files -----------------------------------------------------

# Run on its own (curl ... | bash), the installer downloads its release. Run
# from an unpacked bundle or a checkout, it uses the files already there.
release_base=${IDAH_RELEASE_BASE:-https://github.com/idah-ai/idah/releases/download}

checksum() { # <file> -> its sha256
  if command -v sha256sum > /dev/null; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Downloads a release's bundle and unpacks it into a directory, only if it
# matches the published checksum.
fetch_bundle() { # <version> <directory>
  local bundle="idah-$1.tar.gz" dl expected url
  url="$release_base/v$1/$bundle"
  command -v tar > /dev/null || die "tar is required to unpack the release"
  dl=$(mktemp -d)

  curl -fsSL -o "$dl/$bundle" "$url" || { rm -rf "$dl"; die "could not download $url
       Check that this machine can reach it, or download the bundle by hand and run ./install.sh from it."; }
  curl -fsSL -o "$dl/SHA256SUMS" "$release_base/v$1/SHA256SUMS" \
    || { rm -rf "$dl"; die "could not fetch the checksums for $1, so the download cannot be verified"; }
  expected=$(grep " $bundle\$" "$dl/SHA256SUMS" | cut -d' ' -f1)
  [ -n "$expected" ] || { rm -rf "$dl"; die "SHA256SUMS for $1 does not mention $bundle"; }
  [ "$expected" = "$(checksum "$dl/$bundle")" ] \
    || { rm -rf "$dl"; die "$bundle does not match its published checksum. Downloaded from: $url"; }
  echo "   checksum verified"

  mkdir -p "$2"
  tar -xzf "$dl/$bundle" --strip-components=1 -C "$2"
  rm -rf "$dl"
}

# Piped (curl ... | bash): always download, even where a compose.yml happens to
# be, such as a project of the user's. BASH_SOURCE is empty only when piped.
if [ -z "${BASH_SOURCE[0]:-}" ] || [ ! -f compose.yml ]; then
  # IDAH_VERSION picks the release; otherwise the one this installer came from.
  bundle_version=${IDAH_VERSION:-$release_version}
  [ -n "$bundle_version" ] || die "this installer does not carry a release, so there is nothing to download.
       Run it from an unpacked release bundle, or from deploy/compose/ in a checkout,
       or name the release to install: IDAH_VERSION=0.5.0"

  # The install's home: its files, .env, keys and compose project name. Hard to
  # move later, so it is asked.
  target=$(ask "Install IDAH into" "${IDAH_DIR:-$PWD}")
  # A typed ~ arrives as text, so it is expanded here.
  # shellcheck disable=SC2088
  case "$target" in
    "~") target=$HOME ;;
    "~/"*) target="$HOME/${target#\~/}" ;;
  esac
  case "$target" in /*) ;; *) target="$PWD/${target#./}" ;; esac
  target=${target%/}; target=${target:-/}
  # Already downloaded there. What to do depends on how far the install got.
  if [ -f "$target/compose.yml" ]; then
    t_env="$target/$env_file"
    if [ ! -f "$target/$keys_dir/private.pem" ]; then
      die "IDAH was downloaded to $target but not installed yet. To install it:
           cd $target && ./install.sh"
    elif [ -f "$t_env" ] && grep -q '^IDAH_INSTALL_STARTED_AT=.' "$t_env" \
        && ! grep -q '^IDAH_INSTALLED_AT=.' "$t_env"; then
      die "an install in $target did not finish. To carry on with it:
           cd $target && ./install.sh"
    else
      die "$target already holds an install.
       To upgrade it: cd $target && ./install.sh --upgrade"
    fi
  fi

  say "Downloading IDAH $bundle_version"
  # Unpacked aside first: nothing lands in the target until the bundle is
  # verified and none of its files would overwrite one there (except install.sh).
  unpacked=$(mktemp -d)
  trap 'rm -rf "$unpacked"' EXIT
  fetch_bundle "$bundle_version" "$unpacked"

  clashes=$(cd "$unpacked" && find . -type f ! -path ./install.sh | sed 's|^\./||' | sort \
    | while IFS= read -r file; do [ -e "$target/$file" ] && echo "       $file"; done || true)
  [ -z "$clashes" ] || die "$target already has files the install would overwrite:
$clashes
       Choose an empty directory, or move these out of the way."

  mkdir -p "$target" 2> /dev/null && [ -w "$target" ] \
    || die "cannot write to $target. Choose a directory you can write to, or create it first."
  cp -R "$unpacked/." "$target/"
  rm -rf "$unpacked"; trap - EXIT
  cd "$target"
  downloaded_to=$PWD; in_dir="cd $PWD && "
  echo "   unpacked into $PWD"
fi

for file in compose.yml .env.example config/nginx/nginx.conf config/nginx/routes.conf \
            config/nginx/tls-disabled.conf; do
  [ -f "$file" ] || die "$file not found; run this from the directory it lives in"
done

# --- what this run does ------------------------------------------------------

if $provision && $upgrade; then
  die "--provision sets up a database with no IDAH data in it, --upgrade migrates one that has it. Pass one."
fi
if $start_empty && ! $provision; then
  die "--start-empty says what --provision should put in the new database. Pass both, or leave it out to keep the data you have."
fi

# The steps follow the mode:
#
#   new        first install: generates every secret and the signing key
#   resume     first install that failed part-way, run again
#   upgrade    --upgrade
#   provision  --provision
#
# All but new keep what the first install generated.
mode=new
$provision && mode=provision
$upgrade && mode=upgrade

# Two marks in .env: IDAH_INSTALL_STARTED_AT is written with the signing key
# (step 4), IDAH_INSTALLED_AT once every service answers (step 9). Started but
# not installed means the first install failed, so it is resumed. Installs from
# before the marks have neither and are refused, as before.
started_at=""; installed_at=""
if [ -f "$env_file" ]; then
  started_at=$(sed -n 's/^IDAH_INSTALL_STARTED_AT=//p' "$env_file" | tail -1)
  installed_at=$(sed -n 's/^IDAH_INSTALLED_AT=//p' "$env_file" | tail -1)
fi

if [ "$mode" != new ]; then
  [ -f "$env_file" ] || die "--$mode continues an install, and there is no $env_file here.
       For a new install, run ./install.sh"
  [ -f "$keys_dir/private.pem" ] || die "--$mode keeps the existing signing key, and $keys_dir/private.pem is missing.
       Restore it, or start a new install: docker compose down -v && rm -f $env_file"
elif [ -f "$keys_dir/private.pem" ] && [ -n "$started_at" ] && [ -z "$installed_at" ]; then
  mode=resume
  printf '\n   note: an earlier install here did not finish. Carrying on with its\n   settings, secrets and signing key.\n'
elif [ -f "$keys_dir/private.pem" ]; then
  die "IDAH is already installed here ($keys_dir/private.pem exists).

       To change a setting:      edit $env_file, then
                                 docker compose up -d

       After changing            ./install.sh --upgrade
       IDAH_VERSION:             (runs the new migrations, keeps your data)

       After pointing .env at    ./install.sh --provision
       an empty database:        (sets it up; the old one is left untouched)

       To start over:            docker compose down -v
                                 rm -f $env_file && rm -rf $keys_dir
                                 (this deletes the databases and uploaded files)"
fi

# --- upgrade: the new release's files ----------------------------------------

# New images expect their release's compose.yml, nginx configuration and
# installer. So --upgrade downloads the release IDAH_VERSION names, replaces
# these files, and hands over to the new installer, which may upgrade
# differently. Skipped in a checkout, whose files are the checkout's.
if $upgrade && [ -n "$release_version" ]; then
  to_version=$(sed -n 's/^IDAH_VERSION=//p' "$env_file" | tail -1 | tr -d "'\"")
  [ -n "$to_version" ] || die "--upgrade upgrades to the release IDAH_VERSION names, and $env_file sets none.
       Set it to the release to upgrade to, e.g. IDAH_VERSION=$release_version"

  # Already handed over: the files are this release's.
  if [ "${IDAH_UPGRADE_FILES:-}" != "$to_version" ]; then
    older() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -1)" = "$1" ]; }
    older "$to_version" "$release_version" && die "IDAH_VERSION is $to_version in $env_file, older than this installer ($release_version).
       To upgrade to $release_version, set IDAH_VERSION=$release_version. Going back to an older
       release is not supported: its code would run against the newer schema."

    say "Fetching the files of IDAH $to_version"
    new=$(mktemp -d)
    trap 'rm -rf "$new"' EXIT
    fetch_bundle "$to_version" "$new"

    # Replaced files are kept in .previous-files/. .env, compose.override.yml,
    # config/keys and config/certs are not in a bundle, so they are untouched.
    kept=".previous-files/$(date -u +%Y%m%dT%H%M%SZ)"
    changed=0
    while IFS= read -r file; do
      if [ -f "$file" ] && cmp -s "$new/$file" "$file"; then continue; fi
      if [ -f "$file" ]; then
        mkdir -p "$kept/$(dirname "$file")"
        cp -p "$file" "$kept/$file"
      fi
      mkdir -p "$(dirname "$file")"
      # Moved into place, not written over: bash is still reading this script.
      cp -p "$new/$file" "$file.new" && mv -f "$file.new" "$file"
      echo "   $file"
      changed=$((changed + 1))
    done < <(cd "$new" && find . -type f | sed 's|^\./||' | sort)

    if [ "$changed" = 0 ]; then
      echo "   already this release's"
    else
      echo "   the previous versions are in $kept/"
    fi

    # exec skips the EXIT trap, so clean up first.
    rm -rf "$new"; trap - EXIT
    exec env IDAH_UPGRADE_FILES="$to_version" bash ./install.sh ${args[@]+"${args[@]}"}
  fi
fi

# --- steps -------------------------------------------------------------------

# Each step is a file in install/, run in order in this shell, so it sees the
# variables of the steps before it. Steps 1-3 only check; step 4 is the first
# to write. Since the steps share variables, each turns off shellcheck's
# "assigned but unused" and "used but not assigned" checks.
[ -f install/lib.sh ] || die "install/ is missing next to install.sh. Run the installer from the
       unpacked release bundle, or from deploy/compose/ in a checkout."

copied=false # step 6 sets it when it copies the old data

. install/lib.sh                # helpers the steps share
. install/01-settings.sh        # read and check the settings
. install/02-project.sh         # pick the compose project name
. install/03-preflight.sh       # ports, TLS files, images, external servers
. install/04-env.sh             # write .env: secrets, signing key
. install/05-databases.sh       # start PostgreSQL and Redis, check the database
if [ "$mode" = provision ]; then
  . install/06-copy-database.sh # --provision only: copy the bundled data over
fi
. install/07-migrations.sh      # create the databases, run the migrations
. install/08-accounts.sh        # service accounts and the administrator
. install/09-start.sh           # start, check every service, mark installed
. install/10-summary.sh         # print what was installed
