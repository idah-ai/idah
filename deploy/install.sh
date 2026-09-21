#!/usr/bin/env bash
#
# Install IDAH. Generates every secret, prepares the databases and starts the
# stack. Refuses to run over an existing install (a .env already present).
#
#   ./install.sh              asks for anything not given as an option
#   ./install.sh --yes ...    asks nothing; defaults for anything not given
#
# Options:
#   --url URL                     public URL users open
#   --port PORT                   port nginx listens on (default 8080)
#   --admin-email EMAIL           administrator login
#   --admin-name NAME
#   --version VERSION             release to install
#   --image-prefix PREFIX         images built from source, e.g. idah-
#   --smtp-host HOST              omit to disable email notifications
#   --smtp-port PORT              default 587
#   --smtp-user USER
#   --smtp-password PASSWORD
#   --postgres-host HOST          use this PostgreSQL instead of the bundled one
#   --postgres-port PORT          default 5432
#   --postgres-user USER
#   --postgres-password PASSWORD
#   --postgres-sslmode MODE       disable, prefer, require (default), verify-full
#   -y, --yes
#
# Requires docker, docker compose and openssl.
set -euo pipefail

self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"

compose_file=compose.yml
env_file=.env
keys_dir=config/keys

url=""; admin_email=""; admin_name="Administrator"
smtp_host=""; smtp_port=587; smtp_user=""; smtp_password=""
version=""; image_prefix=""; http_port=8080
pg_host=""; pg_port=5432; pg_user=""; pg_password=""; pg_sslmode=""
assume_yes=false

die() { echo "error: $*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) url=${2:?}; shift 2 ;;
    --admin-email) admin_email=${2:?}; shift 2 ;;
    --admin-name) admin_name=${2:?}; shift 2 ;;
    --smtp-host) smtp_host=${2:?}; shift 2 ;;
    --smtp-port) smtp_port=${2:?}; shift 2 ;;
    --smtp-user) smtp_user=${2:?}; shift 2 ;;
    --smtp-password) smtp_password=${2:?}; shift 2 ;;
    --version) version=${2:?}; shift 2 ;;
    --image-prefix) image_prefix=${2:?}; shift 2 ;;
    --port) http_port=${2:?}; shift 2 ;;
    --postgres-host) pg_host=${2:?}; shift 2 ;;
    --postgres-port) pg_port=${2:?}; shift 2 ;;
    --postgres-user) pg_user=${2:?}; shift 2 ;;
    --postgres-password) pg_password=${2:?}; shift 2 ;;
    --postgres-sslmode) pg_sslmode=${2:?}; shift 2 ;;
    -y|--yes) assume_yes=true; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$self"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

# --- checks ----------------------------------------------------------------

for tool in docker openssl; do
  command -v "$tool" > /dev/null || die "$tool is required but not installed"
done
docker compose version > /dev/null 2>&1 || die "docker compose (v2) is required"
docker info > /dev/null 2>&1 || die "cannot talk to the Docker daemon; is it running?"
[ -f "$compose_file" ] || die "$compose_file not found; run this from the directory it lives in"
[ -f nginx.conf ] || die "nginx.conf not found next to $compose_file"
[ -f .env.example ] || die ".env.example not found next to $compose_file"

if [ -f "$env_file" ]; then
  die "$env_file already exists. This installer only creates a new install.

       To change a setting:   edit $env_file, then
                              docker compose up -d

       To start over:         docker compose down -v
                              rm -f $env_file && rm -rf $keys_dir
                              (this deletes the databases and uploaded files)"
fi

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

default_prefix=ghcr.io/idah-ai/idah-

[ -n "$url" ]          || url=$(ask "Public URL users will open" "http://localhost:$http_port")
[ -n "$admin_email" ]  || admin_email=$(ask "Administrator email" "admin@example.com")
[ -n "$version" ]      || version=$(ask "IDAH version to install" "")
[ -n "$version" ]      || die "a version is required (--version)"
[ -n "$image_prefix" ] || image_prefix=$(ask "Image source (change only if you built the images yourself)" "$default_prefix")
[ -n "$smtp_host" ]    || smtp_host=$(ask "SMTP host (leave empty to disable email notifications)" "")
if [ -n "$smtp_host" ]; then
  [ -n "$smtp_user" ]     || smtp_user=$(ask "SMTP user (leave empty if none)" "")
  if [ -n "$smtp_user" ] && [ -z "$smtp_password" ]; then
    smtp_password=$(ask "SMTP password" "")
  fi
fi
case "$smtp_user$smtp_password" in
  *"'"*) die "the SMTP user and password cannot contain a single quote (')" ;;
esac

# --- database settings -----------------------------------------------------

if [ -z "$pg_host" ] && ! $assume_yes; then
  case $(ask "Use the bundled PostgreSQL? (yes/no)" "yes") in
    n|N|no|No|NO)
      pg_host=$(ask "PostgreSQL host" "")
      [ -n "$pg_host" ] || die "a PostgreSQL host is required"
      pg_port=$(ask "PostgreSQL port" "$pg_port") ;;
  esac
fi

external=false
[ -n "$pg_host" ] && external=true

if $external; then
  case "$pg_host" in
    localhost|127.*|::1|0.0.0.0)
      die "PostgreSQL host '$pg_host' would make every container connect to itself.
       For a PostgreSQL running on this machine, use host.docker.internal." ;;
  esac
  [ -n "$pg_user" ]     || pg_user=$(ask "PostgreSQL user" "idah")
  [ -n "$pg_password" ] || pg_password=$(ask "PostgreSQL password" "")
  [ -n "$pg_password" ] || die "a PostgreSQL password is required (--postgres-password)"
  [ -n "$pg_sslmode" ]  || pg_sslmode=$(ask "PostgreSQL SSL mode (disable, prefer, require, verify-full)" "require")
  case "$pg_sslmode" in
    disable|allow|prefer|require|verify-ca|verify-full) ;;
    *) die "unknown SSL mode '$pg_sslmode'" ;;
  esac
  # .env stores it single-quoted, so every other character is taken literally.
  case "$pg_password" in
    *"'"*) die "the PostgreSQL password cannot contain a single quote (')" ;;
  esac
fi
pg_user=${pg_user:-idah}

# --- images ----------------------------------------------------------------

# Before anything is written, so a wrong version or an unreachable registry
# fails with nothing left behind.
services="iam dataset media setting notification sync audit"
prefix=${image_prefix:-$default_prefix}

say "Checking images"
for svc in $services frontend; do
  image="$prefix$svc:$version"
  docker image inspect "$image" > /dev/null 2>&1 && continue

  printf "   pulling %s\n" "$image"
  docker pull -q "$image" > /dev/null 2>&1 || die "cannot get $image

       If these images are built from source rather than published, pass the
       prefix they were tagged with, for example:

           --image-prefix idah- --version local

       Otherwise check that $version is a published version and that this
       machine can reach the registry."
done
echo "   all eight present"

# Also before anything is written: wrong credentials, TLS or an unreachable host
# fail here with nothing left behind. Runs in a service image, so it tests what
# the services will use.
if $external; then
  say "Connecting to PostgreSQL at $pg_host:$pg_port"
  if ! reason=$(docker run --rm --add-host=host.docker.internal:host-gateway \
      -e "DATABASE_URI=postgres://$pg_user@$pg_host:$pg_port/postgres?sslmode=$pg_sslmode" \
      -e "PGPASSWORD=$pg_password" "${prefix}iam:$version" ruby -e '
        require "sequel"
        begin
          Sequel.connect(ENV.fetch("DATABASE_URI")) { |db| db.test_connection }
        rescue StandardError => e
          warn e.message.lines.first.strip
          exit 1
        end' 2>&1 < /dev/null); then
    die "cannot connect to PostgreSQL at $pg_host:$pg_port as $pg_user:
       $(printf '%s\n' "$reason" | tail -1)"
  fi
  echo "   connected (sslmode=$pg_sslmode)"
fi

# --- secrets ---------------------------------------------------------------

# Alphanumeric only: these end up in a URI, in .env and in a comma/colon
# separated list of service credentials. `cut` rather than `head -c`, which
# would close the pipe early and trip pipefail.
secret() {
  n=${1:-32}
  openssl rand -base64 $((n * 3)) | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-"$n"
}

say "Generating secrets"
if $external; then postgres_password=$pg_password; else postgres_password=$(secret 32); fi
admin_password=$(secret 20)

# Each service account gets its own password. Generated once here, then used
# both in .env and in the credentials handed to service_accounts:create.
# Plain strings rather than an associative array, so this runs on bash 3.
service_env=""
service_list=""
for svc in $services; do
  pw=$(secret 32)
  service_env="${service_env}IDAH_SERVICE_PASSWORD_$(echo "$svc" | tr '[:lower:]' '[:upper:]')=$pw
"
  service_list="${service_list:+$service_list,}$svc:$pw"
done

say "Generating the signing key pair"
mkdir -p "$keys_dir"
openssl ecparam -name prime256v1 -genkey -noout -out "$keys_dir/private.pem" 2> /dev/null
openssl ec -in "$keys_dir/private.pem" -pubout -out "$keys_dir/public.pem" 2> /dev/null
chmod 600 "$keys_dir/private.pem"
echo "   $keys_dir/private.pem (iam signs tokens with it)"
echo "   $keys_dir/public.pem  (the other services verify with it)"

# --- .env ------------------------------------------------------------------

# Built from .env.example, so the customer's file carries every optional
# setting, documented and commented out, and the two can never drift apart.

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
quote() { printf "'%s'" "$1"; } # single-quoted: every character taken literally

say "Writing $env_file"
saved_umask=$(umask); umask 077 # secrets: never readable by other users
{ echo "# Generated by install.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')."; cat .env.example; } > "$env_file"

set_env IDAH_VERSION "$version"
[ "$prefix" != "$default_prefix" ] && set_env IDAH_IMAGE_PREFIX "$prefix"
set_env IDAH_URL "$url"
set_env IDAH_HTTP_PORT "$http_port"

set_env POSTGRES_USER "$pg_user"
set_env POSTGRES_PASSWORD "$(quote "$postgres_password")"
if $external; then
  set_env IDAH_POSTGRES_CONTAINER 0
  set_env POSTGRES_HOST "$pg_host"
  set_env POSTGRES_PORT "$pg_port"
  set_env POSTGRES_SSLMODE "$pg_sslmode"
fi

printf '%s' "$service_env" | while IFS='=' read -r key value; do set_env "$key" "$value"; done

set_env MAIL_SMTP_HOST "$smtp_host"
set_env MAIL_SMTP_PORT "$smtp_port"
set_env MAIL_SMTP_USER "$(quote "$smtp_user")"
set_env MAIL_SMTP_PASSWORD "$(quote "$smtp_password")"
umask "$saved_umask"

# No -f: under its default name compose.yml, compose also merges the
# customer's compose.override.yml, which naming the file explicitly would skip.
dc() { docker compose "$@"; }

# --- databases -------------------------------------------------------------

if $external; then
  say "Starting Redis"
  dc up -d redis
else
  say "Starting PostgreSQL and Redis"
  dc up -d postgres redis

  printf "   waiting for PostgreSQL"
  for _ in $(seq 1 60); do
    if dc exec -T postgres pg_isready -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1; then break; fi
    printf "."; sleep 2
  done
  dc exec -T postgres pg_isready -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1 || die "PostgreSQL did not become ready"
  echo " ready"
fi

say "Creating databases and running migrations"
for svc in $services; do
  printf "   %-13s" "$svc"
  dc run --rm "$svc" bundle exec rake db:setup db:migrate < /dev/null > /dev/null 2>&1 \
    || die "migrations failed for $svc. Re-run without redirecting output to see why:
       docker compose run --rm $svc bundle exec rake db:setup db:migrate
$($external && printf '%s' "
       With an external database, $pg_user needs the CREATEDB privilege, or the
       idah_* databases must be created in advance and owned by $pg_user.")"
  echo "ok"
done

# --- accounts --------------------------------------------------------------

say "Creating accounts"
dc run --rm -e "SERVICES=$service_list" iam bundle exec rake service_accounts:create < /dev/null > /dev/null \
  || die "could not create the service accounts"
echo "   seven service accounts, each with its own password"

dc run --rm iam bundle exec rake api_key_service_account:create < /dev/null > /dev/null \
  || die "could not create the API service account"
echo "   API service account"

dc run --rm -e "ADMIN_EMAIL=$admin_email" -e "ADMIN_PASSWORD=$admin_password" \
  -e "ADMIN_NAME=$admin_name" iam bundle exec rake admin:create < /dev/null > /dev/null \
  || die "could not create the administrator account"
echo "   administrator $admin_email"

# --- start -----------------------------------------------------------------

say "Starting IDAH"
dc up -d

printf "   waiting for the stack"
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://localhost:$http_port/health" > /dev/null 2>&1; then break; fi
  printf "."; sleep 2
done
echo

cat <<SUMMARY

IDAH $version is installed.

  URL       $url
  Login     $admin_email
  Password  $admin_password
  Database  $($external && echo "$pg_host:$pg_port (sslmode=$pg_sslmode)" || echo "bundled, in the postgres_data volume")

Write the password down now: it is not stored anywhere and cannot be recovered.
Change it after the first login.

Settings live in $env_file. Uploaded files live in the media_files and
sync_files volumes — include them in your backups, along with the database.

  Status    docker compose ps
  Logs      docker compose logs -f
  Stop      docker compose down
SUMMARY
