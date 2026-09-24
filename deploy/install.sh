#!/usr/bin/env bash
#
# Install IDAH: generates every secret, prepares the databases, creates the
# accounts and starts the stack.
#
#   ./install.sh
#
# Settings come from .env. Without one it is created from .env.example, and
# IDAH runs with its own PostgreSQL and Redis. To change that or anything else,
# create .env first (cp .env.example .env), edit it, then run this; see
# README.md. Values already in .env are kept: only empty secrets are generated.
#
# A setting .env leaves empty may also be given in the environment, which is
# written into .env:
#
#   IDAH_VERSION=0.0.0-local IDAH_IMAGE_PREFIX=idah- ./install.sh
#
# It asks for the public URL (unless IDAH_URL is set) and the administrator's
# email.
#
#   --admin-email EMAIL    administrator login, instead of asking
#   --admin-name NAME      default Administrator
#   -y, --yes              ask nothing; defaults for anything not set
#   --encode               percent-encode a password for REDIS_URL, then exit
#
# Requires docker, docker compose, openssl and curl.
set -euo pipefail

self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"

env_file=.env
keys_dir=config/keys
certs_dir=config/certs
services="iam dataset media setting notification sync audit"
default_prefix=ghcr.io/idah-ai/idah-

# The release this installer belongs to, filled in when the release is published.
release_version=""

admin_email=""; admin_name="Administrator"
assume_yes=false; encode=false

die() { echo "error: $*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --admin-email) admin_email=${2:?}; shift 2 ;;
    --admin-name) admin_name=${2:?}; shift 2 ;;
    -y|--yes) assume_yes=true; shift ;;
    --encode) encode=true; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$self"; exit 0 ;;
    *) die "unknown argument: $1 (settings go in .env; see --help)" ;;
  esac
done

ask() { # <prompt> <default>
  local answer
  if $assume_yes; then echo "${2:-}"; return; fi
  if [ ! -t 0 ] && { : < /dev/tty; } 2> /dev/null; then
    # Stdin is the script itself (curl ... | bash): ask the terminal instead.
    read -r -p "$1${2:+ [$2]}: " answer < /dev/tty
  else
    # A terminal, or answers piped in one per line.
    read -r -p "$1${2:+ [$2]}: " answer
  fi
  echo "${answer:-${2:-}}"
}

# Percent-encodes every byte outside the RFC 3986 unreserved set. Byte by byte
# through od: bash's printf "'c" mangles bytes above 127, differently per version.
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
  # Read without echo, so the password stays off the screen and out of the history.
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
for file in compose.yml nginx.conf routes.conf tls-disabled.conf .env.example; do
  [ -f "$file" ] || die "$file not found; run this from the directory it lives in"
done

if [ -f "$keys_dir/private.pem" ]; then
  die "IDAH is already installed here ($keys_dir/private.pem exists).

       To change a setting:   edit $env_file, then
                              docker compose up -d

       To start over:         docker compose down -v
                              rm -rf $keys_dir
                              (this deletes the databases and uploaded files)"
fi

# --- settings --------------------------------------------------------------

# Nothing is written until every check below has passed, so a failed check
# leaves nothing behind. Until then settings are read from .env, or from the
# template when there is none.
settings=$env_file
[ -f "$settings" ] || settings=.env.example

# The value of KEY in this shell, empty if unset. eval rather than ${!KEY},
# which bash 3 (macOS) handles differently; every key here comes from the
# template, so it is a plain name.
from_env() { # <key>
  eval "printf '%s' \"\${$1:-}\""
}

# The value of KEY in the settings file: the last KEY= line, one layer of
# surrounding quotes removed. Commented-out lines are not settings.
from_file() { # <key>
  local v
  v=$(sed -n "s/^$1=//p" "$settings" | tail -1)
  case "$v" in
    \'*\') v=${v#\'}; v=${v%\'} ;;
    \"*\") v=${v#\"}; v=${v%\"} ;;
  esac
  printf '%s' "$v"
}

# What the install will use: the file, and the environment for what it leaves
# empty (IDAH_VERSION=0.0.0-local ./install.sh). Anything taken from the
# environment is written into .env below, so later docker compose commands see
# it without it being set again.
get() { # <key>
  local v
  v=$(from_file "$1")
  [ -n "$v" ] || v=$(from_env "$1")
  printf '%s' "$v"
}

# Which settings this run takes from the environment: those the template
# documents that .env leaves empty. Collected here, written in below, so a bad
# value stops the install before anything is written.
env_keys=""
for key in $(sed -n 's/^#* *\([A-Z][A-Z_0-9]*\)=.*/\1/p' .env.example | sort -u); do
  value=$(from_env "$key")
  [ -n "$value" ] || continue
  [ -n "$(from_file "$key")" ] && continue
  case "$value" in *"'"*) die "$key cannot contain a single quote (')" ;; esac
  env_keys="${env_keys:+$env_keys }$key"
done

version=$(get IDAH_VERSION); version=${version:-$release_version}
[ -n "$version" ] || version=$(ask "IDAH version to install" "")
[ -n "$version" ] || die "a version is required: set IDAH_VERSION in $env_file"

http_port=$(get IDAH_HTTP_PORT); http_port=${http_port:-8080}
https_port=$(get IDAH_HTTPS_PORT); https_port=${https_port:-8443}
prefix=$(get IDAH_IMAGE_PREFIX); prefix=${prefix:-$default_prefix}

url=$(get IDAH_URL)
[ -n "$url" ] || url=$(ask "Public URL users will open" "http://localhost:$http_port")
[ -n "$admin_email" ] || admin_email=$(ask "Administrator email" "admin@example.com")

refuse_localhost() { # <what> <host>
  case "$2" in
    localhost|127.*|::1|\[::1\]|0.0.0.0)
      die "$1 host '$2' would make every container connect to itself.
       For a server running on this machine, use host.docker.internal." ;;
  esac
}

# PostgreSQL: the bundled one unless POSTGRES_HOST names another.
pg_host=$(get POSTGRES_HOST)
external=false
[ -n "$pg_host" ] && [ "$pg_host" != postgres ] && external=true
pg_port=$(get POSTGRES_PORT); pg_port=${pg_port:-5432}
pg_user=$(get POSTGRES_USER); pg_user=${pg_user:-idah}
pg_password=$(get POSTGRES_PASSWORD)
pg_sslmode=$(get POSTGRES_SSLMODE)

if $external; then
  refuse_localhost PostgreSQL "$pg_host"
  [ -n "$pg_password" ] || die "POSTGRES_HOST is set, so POSTGRES_PASSWORD must be too: the password of $pg_user on $pg_host"
  # Encrypted unless the setting says otherwise; require needs no CA.
  pg_sslmode=${pg_sslmode:-require}
fi
case "${pg_sslmode:-prefer}" in
  disable|allow|prefer|require|verify-ca|verify-full) ;;
  *) die "unknown POSTGRES_SSLMODE '$pg_sslmode'" ;;
esac

# Redis: the bundled one unless REDIS_URL names another.
redis_url=$(get REDIS_URL)
external_redis=false
if [ -n "$redis_url" ]; then
  external_redis=true
  case "$redis_url" in
    redis://*|rediss://*) ;;
    *) die "REDIS_URL must start with redis:// or rediss:// (TLS)" ;;
  esac
  redis_addr=${redis_url#*://}; redis_addr=${redis_addr##*@}; redis_addr=${redis_addr%%/*}
  refuse_localhost Redis "${redis_addr%%:*}"
fi

# A CA certificate, given as its path inside the containers: config/certs here.
ca=$(get IDAH_CA_CERT)
ca_file=""
ca_mount=()
if [ -n "$ca" ]; then
  case "$ca" in
    /certs/*) ca_file="$certs_dir/${ca#/certs/}" ;;
    *) die "IDAH_CA_CERT must be a path under /certs, which is $certs_dir on this machine" ;;
  esac
  [ -r "$ca_file" ] || die "IDAH_CA_CERT is $ca, but $ca_file does not exist"
  openssl x509 -in "$ca_file" -noout 2> /dev/null || die "$ca_file is not a PEM certificate"
  ca_mount=(-v "$PWD/$certs_dir:/certs:ro" -e "SSL_CERT_FILE=$ca")
fi

# libpq has no system trust store to fall back on, so verification needs a file.
case "$pg_sslmode" in
  verify-ca|verify-full)
    [ -n "$ca" ] || die "POSTGRES_SSLMODE=$pg_sslmode needs the CA certificate the PostgreSQL
       server's certificate is signed by: put it in $certs_dir/ca.pem and set
       IDAH_CA_CERT=/certs/ca.pem (for a managed database, your provider's CA bundle)." ;;
esac

# --- images ----------------------------------------------------------------

# HTTPS served by IDAH's own nginx: the certificate and its key must be there,
# match each other, and the key must not need a passphrase, or nginx fails to
# start after everything else has been set up.
tls_conf=$(get IDAH_TLS_CONF)
if [ -n "$tls_conf" ]; then
  [ -f "$tls_conf" ] || die "IDAH_TLS_CONF is $tls_conf, which does not exist next to compose.yml"
  for f in "$certs_dir/idah.crt" "$certs_dir/idah.key"; do
    [ -r "$f" ] || die "$tls_conf serves HTTPS from $certs_dir/idah.crt and $certs_dir/idah.key. Missing: $f"
  done
  openssl x509 -in "$certs_dir/idah.crt" -noout 2> /dev/null \
    || die "$certs_dir/idah.crt is not a PEM certificate"
  openssl pkey -in "$certs_dir/idah.key" -noout 2> /dev/null \
    || die "$certs_dir/idah.key is not a PEM private key, or it needs a passphrase, which nginx cannot supply"
  crt_key=$(openssl x509 -in "$certs_dir/idah.crt" -noout -pubkey 2> /dev/null)
  key_key=$(openssl pkey -in "$certs_dir/idah.key" -pubout 2> /dev/null)
  [ "$crt_key" = "$key_key" ] || die "$certs_dir/idah.key is not the key of $certs_dir/idah.crt"
elif [ "${url#https://}" != "$url" ]; then
  # An https:// address with no TLS here only works behind a terminator, which
  # is not something this installer can check for.
  printf '\n   note: IDAH serves plain HTTP on port %s. %s expects TLS to be terminated\n   in front of it, or IDAH_TLS_CONF set — see "Serving HTTPS" in README.md.\n' "$http_port" "$url"
fi

say "Checking images"
for svc in $services frontend; do
  image="$prefix$svc:$version"
  docker image inspect "$image" > /dev/null 2>&1 && continue

  printf "   pulling %s\n" "$image"
  docker pull -q "$image" > /dev/null 2>&1 || die "cannot get $image

       If these images are built from source rather than published, set the
       prefix they were tagged with in $env_file, for example:

           IDAH_IMAGE_PREFIX=idah-
           IDAH_VERSION=local

       Otherwise check that $version is a published version and that this
       machine can reach the registry."
done
echo "   all eight present"

# --- external servers --------------------------------------------------------

# What to do about a certificate the server presents but we cannot verify.
tls_hint() { # <reason>
  case "$1" in
    *"certificate verify failed"*)
      if [ -n "$ca" ]; then
        printf '\n       Check that %s includes the CA that signed the server'"'"'s certificate.' "$ca_file"
      else
        printf '\n       If the server'"'"'s certificate is signed by your own CA, see IDAH_CA_CERT in %s.' "$env_file"
      fi ;;
  esac
}

# Run in a service image, so they test what the services will use.
if $external; then
  say "Connecting to PostgreSQL at $pg_host:$pg_port"
  if ! reason=$(docker run --rm --add-host=host.docker.internal:host-gateway ${ca_mount[@]+"${ca_mount[@]}"} \
      -e "DATABASE_URI=postgres://$pg_user@$pg_host:$pg_port/postgres?sslmode=$pg_sslmode${ca:+&sslrootcert=$ca}" \
      -e "PGPASSWORD=$pg_password" "${prefix}iam:$version" ruby -e '
        require "sequel"
        begin
          Sequel.connect(ENV.fetch("DATABASE_URI")) { |db| db.test_connection }
        rescue StandardError => e
          warn e.message.lines.first.strip
          exit 1
        end' 2>&1 < /dev/null); then
    hint=""
    case "$reason" in
      *"does not support SSL"*) hint="
       Set POSTGRES_SSLMODE=disable in $env_file for a server without TLS." ;;
    esac
    die "cannot connect to PostgreSQL at $pg_host:$pg_port as $pg_user:
       $(printf '%s\n' "$reason" | tail -1)$hint$(tls_hint "$reason")"
  fi
  echo "   connected (sslmode=$pg_sslmode)"
fi

if $external_redis; then
  say "Connecting to Redis at $redis_addr"
  if ! reason=$(docker run --rm --add-host=host.docker.internal:host-gateway ${ca_mount[@]+"${ca_mount[@]}"} \
      -e "REDIS_URL=$redis_url" "${prefix}iam:$version" ruby -e '
        require "redis"
        begin
          Redis.new(url: ENV.fetch("REDIS_URL")).ping
        rescue StandardError => e
          # A failed TLS handshake comes back with an empty message.
          message = e.message.lines.first.to_s.strip
          message = "no answer to the TLS handshake #{message}" if message.start_with?("(")
          warn message
          exit 1
        end' 2>&1 < /dev/null); then
    hint=""
    case "$reason" in
      *"TLS handshake"*) hint="
       Does the server accept TLS? rediss:// connects with TLS, redis:// without." ;;
      *WRONGPASS*|*NOAUTH*|*"invalid password"*|*"bad URI"*) hint="
       A password with characters other than letters, digits and - . _ ~ must be
       percent-encoded in REDIS_URL: ./install.sh --encode" ;;
    esac
    die "cannot connect to Redis at $redis_addr:
       $(printf '%s\n' "$reason" | tail -1)$hint$(tls_hint "$reason")"
  fi
  case "$redis_url" in rediss://*) echo "   connected over TLS" ;; *) echo "   connected" ;; esac
fi

# --- secrets ---------------------------------------------------------------

# Alphanumeric only: these end up in a URI, in .env and in a comma/colon
# separated list of service credentials. `cut` rather than `head -c`, which
# would close the pipe early and trip pipefail.
secret() {
  n=${1:-32}
  openssl rand -base64 $((n * 3)) | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-"$n"
}

# Sets KEY, replacing its line or uncommenting "# KEY=" from the template, and
# appends it if the template has no such line. The value goes through ENVIRON,
# not awk -v, which would interpret backslashes in it.
set_env() { # <key> <value>
  KEY=$1 VAL=$2 awk '
    BEGIN { key = ENVIRON["KEY"]; line = key "=" ENVIRON["VAL"] }
    !done && ($0 ~ ("^" key "=") || $0 ~ ("^# " key "=")) { print line; done = 1; next }
    { print }
    END { if (!done) print line }
  ' "$env_file" > "$env_file.tmp" && mv "$env_file.tmp" "$env_file"
}

say "Writing $env_file"
saved_umask=$(umask); umask 077 # secrets: never readable by other users
if [ ! -f "$env_file" ]; then
  { echo "# Created by install.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')."; cat .env.example; } > "$env_file"
fi
chmod 600 "$env_file"
settings=$env_file

# A value is single-quoted unless it is plain enough to stand on its own, so
# spaces and shell characters survive compose reading the file back.
quote() { # <value>
  case "$1" in
    *[!A-Za-z0-9_.:/@=+-]*) printf "'%s'" "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

# The settings collected from the environment, written in so docker compose
# sees them later without them being set again.
for key in $env_keys; do
  set_env "$key" "$(quote "$(from_env "$key")")"
  echo "   $key from the environment"
done

[ -n "$(from_file IDAH_VERSION)" ] || set_env IDAH_VERSION "$version"
[ -n "$(from_file IDAH_URL)" ]     || set_env IDAH_URL "$url"

if [ -z "$pg_password" ]; then
  pg_password=$(secret 32)
  set_env POSTGRES_PASSWORD "'$pg_password'"
fi
if $external; then
  [ -n "$(from_file IDAH_POSTGRES_CONTAINER)" ] || set_env IDAH_POSTGRES_CONTAINER 0
  [ -n "$(from_file POSTGRES_SSLMODE)" ]        || set_env POSTGRES_SSLMODE "$pg_sslmode"
fi
if $external_redis; then
  [ -n "$(from_file IDAH_REDIS_CONTAINER)" ] || set_env IDAH_REDIS_CONTAINER 0
fi

# Each service account gets its own password, kept if .env already has one, and
# handed to service_accounts:create as svc:password pairs.
service_list=""
for svc in $services; do
  key="IDAH_SERVICE_PASSWORD_$(echo "$svc" | tr '[:lower:]' '[:upper:]')"
  pw=$(from_file "$key")
  if [ -z "$pw" ]; then pw=$(secret 32); set_env "$key" "$pw"; fi
  service_list="${service_list:+$service_list,}$svc:$pw"
done
echo "   your settings kept, missing secrets generated"

mkdir -p "$keys_dir" "$certs_dir"
openssl ecparam -name prime256v1 -genkey -noout -out "$keys_dir/private.pem" 2> /dev/null
openssl ec -in "$keys_dir/private.pem" -pubout -out "$keys_dir/public.pem" 2> /dev/null
umask "$saved_umask"
chmod 644 "$keys_dir/public.pem"
echo "   $keys_dir/private.pem (iam signs tokens with it)"
echo "   $keys_dir/public.pem  (the other services verify with it)"

# No -f: under its default name compose.yml, compose also merges the
# customer's compose.override.yml, which naming the file explicitly would skip.
dc() { docker compose "$@"; }

# From here on a failure leaves a partial install. Settings and secrets stay in
# .env, so after fixing the cause the installer can simply run again.
retry="After fixing it: rm -rf $keys_dir && ./install.sh (the settings and secrets in $env_file are kept)"

# --- databases -------------------------------------------------------------

bundled=""
$external || bundled="postgres"
$external_redis || bundled="$bundled redis"
if [ -n "$bundled" ]; then
  say "Starting the bundled services:$(printf ' %s' $bundled)"
  dc up -d $bundled
fi

if ! $external; then
  printf "   waiting for PostgreSQL"
  for _ in $(seq 1 60); do
    if dc exec -T postgres pg_isready -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1; then break; fi
    printf "."; sleep 2
  done
  dc exec -T postgres pg_isready -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1 \
    || die "PostgreSQL did not become ready. See: docker compose logs postgres
       $retry"
  echo " ready"
fi

say "Creating databases and running migrations"
for svc in $services; do
  printf "   %-13s" "$svc"
  dc run --rm "$svc" bundle exec rake db:setup db:migrate < /dev/null > /dev/null 2>&1 \
    || die "migrations failed for $svc. To see why:
       docker compose run --rm $svc bundle exec rake db:setup db:migrate
$($external && printf '%s' "
       With an external database, $pg_user needs the CREATEDB privilege, or the
       idah_* databases must be created in advance and owned by $pg_user.")
       $retry"
  echo "ok"
done

# --- accounts --------------------------------------------------------------

say "Creating accounts"
admin_password=$(secret 20)

dc run --rm -e "SERVICES=$service_list" iam bundle exec rake service_accounts:create < /dev/null > /dev/null 2>&1 \
  || die "could not create the service accounts. $retry"
echo "   seven service accounts, each with its own password"

dc run --rm iam bundle exec rake api_key_service_account:create < /dev/null > /dev/null 2>&1 \
  || die "could not create the API service account. $retry"
echo "   API service account"

dc run --rm -e "ADMIN_EMAIL=$admin_email" -e "ADMIN_PASSWORD=$admin_password" \
  -e "ADMIN_NAME=$admin_name" iam bundle exec rake admin:create < /dev/null > /dev/null 2>&1 \
  || die "could not create the administrator account. $retry"
echo "   administrator $admin_email"

# --- start -----------------------------------------------------------------

say "Starting IDAH"
# Recreated even if unchanged: after a retry, containers from the failed run
# would still hold the key files that were replaced.
dc up -d --force-recreate

# Not /health: nginx answers that itself. iam answering through nginx means
# both are up, and every service's own check below needs it.
printf "   waiting for iam"
for _ in $(seq 1 90); do
  if curl -fsS --max-time 2 "http://localhost:$http_port/api/v1/iam/healthcheck" > /dev/null 2>&1; then break; fi
  printf "."; sleep 2
done
curl -fsS --max-time 2 "http://localhost:$http_port/api/v1/iam/healthcheck" > /dev/null 2>&1 \
  || die "iam did not come up. See: docker compose logs iam"
echo " ready"

# Each service logs in to iam with its own account, through the address its
# service-to-service calls use. Catches a wrong internal URL or password here
# instead of at the first upload.
say "Checking service-to-service calls"
for svc in $services; do
  printf "   %-13s" "$svc"
  if ! out=$(dc exec -T "$svc" bundle exec rake api:check < /dev/null 2>&1); then
    die "the stack is running, but $svc cannot reach the other services:
       $( { printf '%s\n' "$out" | grep -E '^FAILED' || printf '%s\n' "$out" | grep -v -e COMMON_PATH -e '^/' -e '^Tasks:' -e '^(See'; } | tail -1)
       See: docker compose logs $svc"
  fi
  echo "ok"
done

smtp_host=$(get MAIL_SMTP_HOST)

# bash 3 (macOS) cannot parse a case inside $(...), so build this beforehand.
tls_note=""
if [ -n "$tls_conf" ]; then
  tls_note=" (HTTPS on port $https_port, from $certs_dir/idah.crt)"
else
  case "$url" in https://*) tls_note=" (TLS terminated in front of port $http_port)" ;; esac
fi

cat <<SUMMARY

IDAH $version is installed.

  URL       $url$tls_note
  Login     $admin_email
  Password  $admin_password
  Database  $($external && echo "$pg_host:$pg_port (sslmode=$pg_sslmode)" || echo "bundled, in the postgres_data volume")
  Redis     $($external_redis && echo "$redis_addr" || echo "bundled, in the redis_data volume")
  Email     $([ -n "$smtp_host" ] && echo "via $smtp_host" || echo "off until MAIL_SMTP_HOST is set")

Write the password down now: it is not stored anywhere and cannot be recovered.
Change it after the first login.

Settings live in $env_file and README.md describes them. After changing one:
docker compose up -d. Uploaded files live in the media_files and sync_files
volumes — include them in your backups, along with the database.

  Status    docker compose ps
  Logs      docker compose logs -f
  Stop      docker compose down
SUMMARY
