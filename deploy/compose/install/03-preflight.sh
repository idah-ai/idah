# shellcheck shell=bash disable=SC2034,SC2154
# Step 3 of 10: check what would otherwise fail late: the ports, the TLS
# files, the images, and any external PostgreSQL or Redis. Writes nothing.

# --- ports -----------------------------------------------------------------

# Both ports are published, HTTPS even without TLS. A port held by this
# install's own nginx (on a re-run) is fine.
port_taken() { # <port>
  (exec 3<> "/dev/tcp/127.0.0.1/$1") 2> /dev/null || return 1
  exec 3<&- 3>&-
  docker compose ps --format '{{.Ports}}' 2> /dev/null | grep -q ":$1->" && return 1
  return 0
}

for port_pair in "HTTP:$http_port:IDAH_HTTP_PORT" "HTTPS:$https_port:IDAH_HTTPS_PORT"; do
  what=${port_pair%%:*}; rest=${port_pair#*:}; port=${rest%%:*}; setting=${rest#*:}
  if port_taken "$port"; then
    die "port $port is already in use, and IDAH publishes its $what port there.
       Set $setting in $env_file to a free port, or stop what is holding it:
           lsof -nP -iTCP:$port -sTCP:LISTEN"
  fi
done

# --- TLS -------------------------------------------------------------------

# HTTPS from IDAH's own nginx: the certificate and key must exist, match, and
# the key must have no passphrase, or nginx fails to start.
tls_conf=$(get IDAH_TLS_CONF)
if [ -n "$tls_conf" ]; then
  [ -f "$tls_conf" ] || die "IDAH_TLS_CONF is $tls_conf, which does not exist. The one this release
       ships is ./config/nginx/tls.conf"
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
  # https:// without TLS here only works behind a proxy that ends TLS.
  printf '\n   note: IDAH serves plain HTTP on port %s. %s expects TLS to be terminated\n   in front of it, or IDAH_TLS_CONF set — see "Serving HTTPS" in README.md.\n' "$http_port" "$url"
fi

# --- images ----------------------------------------------------------------

say "Checking images"
# Missing images are pulled in parallel: the download is most of the install
# time. Not docker compose pull, which needs .env to exist.
pulls=""
for name in $images; do
  image="$prefix$name:$version"
  docker image inspect "$image" > /dev/null 2>&1 && continue

  printf "   pulling %s\n" "$image"
  docker pull -q "$image" > /dev/null 2>&1 &
  pulls="$pulls $!:$image"
done

missing=""
for pull in $pulls; do
  wait "${pull%%:*}" || missing="${missing:+$missing, }${pull#*:}"
done
[ -z "$missing" ] || die "cannot get $missing

       If these images are built from source rather than published, set the
       prefix they were tagged with in $env_file, for example:

           IDAH_IMAGE_PREFIX=idah-
           IDAH_VERSION=local

       Otherwise check that $version is a published version and that this
       machine can reach the registry."
echo "   all three present"

# --- external servers --------------------------------------------------------

# A hint for a server certificate that cannot be verified.
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

# Connects from the service image, so it tests what the services will use.
if $external; then
  say "Connecting to PostgreSQL at $pg_host:$pg_port"
  if ! reason=$(docker run --rm --add-host=host.docker.internal:host-gateway ${ca_mount[@]+"${ca_mount[@]}"} \
      -e "DATABASE_URI=postgres://$pg_user@$pg_host:$pg_port/postgres?sslmode=$pg_sslmode${ca:+&sslrootcert=$ca}" \
      -e "PGPASSWORD=$pg_password" "${prefix}service:$version" ruby -e '
        require "sequel"
        begin
          Sequel.connect(ENV.fetch("DATABASE_URI")) { |db| puts db.fetch("show server_version_num").single_value }
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

  # 13 or later: from 13, the database owner can create the extensions IDAH
  # uses without being a superuser, which managed databases need.
  pg_server_major=$(( $(printf '%s' "$reason" | tail -1 | tr -dc '0-9' || echo 0) / 10000 ))
  [ "$pg_server_major" -ge 13 ] || die "PostgreSQL at $pg_host:$pg_port is version ${pg_server_major:-unknown}, and IDAH needs 13 or later.
       Older versions cannot create pg_trgm, pgcrypto and uuid-ossp without a superuser."
  echo "   connected (PostgreSQL $pg_server_major, sslmode=$pg_sslmode)"
fi

if $external_redis; then
  say "Connecting to Redis at $redis_addr"
  if ! reason=$(docker run --rm --add-host=host.docker.internal:host-gateway ${ca_mount[@]+"${ca_mount[@]}"} \
      -e "REDIS_URL=$redis_url" "${prefix}service:$version" ruby -e '
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
