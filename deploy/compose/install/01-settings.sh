# shellcheck shell=bash disable=SC2034,SC2154
# Step 1 of 10: read and check the settings, from .env and the environment.
# Writes nothing.

# Nothing is written before step 4, so a failed check leaves nothing behind.
# Until then, settings come from .env, or from the template if there is none.
settings=$env_file
[ -f "$settings" ] || settings=.env.example

# Settings to take from the environment: those the template knows and .env
# leaves empty. Written in by step 4.
env_keys=""
for key in $(sed -n 's/^#* *\([A-Z][A-Z_0-9]*\)=.*/\1/p' .env.example | sort -u); do
  value=$(from_env "$key")
  [ -n "$value" ] || continue
  [ -n "$(from_file "$key")" ] && continue
  case "$value" in *"'"*) die "$key cannot contain a single quote (')" ;; esac
  env_keys="${env_keys:+$env_keys }$key"
done

# A setting that .env and the environment both set, differently. Compose would
# use the environment's and this installer the file's, so they would disagree
# (e.g. the database created for one user, the services logging in as another).
for key in $(sed -n 's/^#* *\([A-Z][A-Z_0-9]*\)=.*/\1/p' .env.example | sort -u); do
  value=$(from_env "$key")
  [ -n "$value" ] || continue
  in_file=$(from_file "$key")
  [ -n "$in_file" ] && [ "$in_file" != "$value" ] || continue
  die "$key is '$in_file' in $settings, but '$value' in this shell.
       docker compose would use the shell's, and this installer the file's.
       Unset it (unset $key), or put the value you want in $env_file."
done

version=$(get IDAH_VERSION); version=${version:-$release_version}
[ -n "$version" ] || version=$(ask "IDAH version to install" "")
[ -n "$version" ] || die "a version is required: set IDAH_VERSION in $env_file"

http_port=$(get IDAH_HTTP_PORT); http_port=${http_port:-8080}
https_port=$(get IDAH_HTTPS_PORT); https_port=${https_port:-8443}
prefix=$(get IDAH_IMAGE_PREFIX); prefix=${prefix:-$default_prefix}

# IDAH_URL must be a full URL: it goes into email links, the API docs and the
# TLS check. A trailing slash is dropped, or it would double up in links.
check_url() { # <value> -> why it is not a URL, or nothing
  case "$1" in
    http://*|https://*) ;;
    [0-9]*) echo "a URL, not just a port: http://localhost:$1" ; return ;;
    *) echo "a URL with a scheme: http://$1 or https://$1" ; return ;;
  esac
  case "$1" in
    http://|https://) echo "the address too, not only the scheme" ;;
  esac
}

url=$(get IDAH_URL)
if [ -n "$url" ]; then
  url=${url%/}
  reason=$(check_url "$url")
  [ -z "$reason" ] || die "IDAH_URL is '$url'. It needs $reason"
else
  # Asked again on a typo, up to three times.
  tries=0
  while :; do
    url=$(ask "Public URL users will open" "http://localhost:$http_port")
    url=${url%/}
    reason=$(check_url "$url")
    [ -n "$reason" ] || break
    tries=$((tries + 1))
    [ "$tries" -lt 3 ] || die "'$url' is not a URL. It needs $reason"
    echo "   '$url' is not a URL. It needs $reason"
  done
fi
# Asked now, with the other questions, if an administrator will be created.
# --provision only knows that in step 8, which asks then.
case "$mode" in
  new|resume) [ -n "$admin_email" ] || admin_email=$(ask "Administrator email" "admin@example.com") ;;
esac

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
  # Encrypted by default; require needs no CA.
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

# A CA certificate, as its path inside the containers (/certs is config/certs).
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

# libpq has no system trust store, so verifying the server needs a CA file.
case "$pg_sslmode" in
  verify-ca|verify-full)
    [ -n "$ca" ] || die "POSTGRES_SSLMODE=$pg_sslmode needs the CA certificate the PostgreSQL
       server's certificate is signed by: put it in $certs_dir/ca.pem and set
       IDAH_CA_CERT=/certs/ca.pem (for a managed database, your provider's CA bundle)." ;;
esac
