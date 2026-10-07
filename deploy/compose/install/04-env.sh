# shellcheck shell=bash disable=SC2034,SC2154
# Step 4 of 10: write .env, generating the secrets it lacks, and the signing
# key on a new install. The first step that writes anything.

[ "$mode" = provision ] && say "Checking $env_file" || say "Writing $env_file"
saved_umask=$(umask); umask 077 # secrets: readable by the owner only
if [ ! -f "$env_file" ]; then
  { echo "# Created by install.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')."; cat .env.example; } > "$env_file"
fi
chmod 600 "$env_file"
settings=$env_file

# Settings given in the environment, written in so compose sees them later.
for key in $env_keys; do
  set_env "$key" "$(quote "$(from_env "$key")")"
  echo "   $key from the environment"
done

# Recorded, so renaming the directory later cannot detach the volumes.
[ -n "$(from_file COMPOSE_PROJECT_NAME)" ] || set_env COMPOSE_PROJECT_NAME "$project"

[ -n "$(from_file IDAH_VERSION)" ] || set_env IDAH_VERSION "$version"
# The cleaned-up URL (no trailing slash).
[ "$(from_file IDAH_URL)" = "$url" ] || set_env IDAH_URL "$url"

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

# One password per service account, kept if .env has it. Passed to step 8 as
# svc:password pairs.
service_list=""
for svc in $services; do
  key="IDAH_SERVICE_PASSWORD_$(echo "$svc" | tr '[:lower:]' '[:upper:]')"
  pw=$(from_file "$key")
  if [ -z "$pw" ]; then pw=$(secret 32); set_env "$key" "$pw"; fi
  service_list="${service_list:+$service_list,}$svc:$pw"
done
echo "   your settings kept, missing secrets generated"

mkdir -p "$keys_dir" "$certs_dir"
if [ "$mode" = new ]; then
  openssl ecparam -name prime256v1 -genkey -noout -out "$keys_dir/private.pem" 2> /dev/null
  openssl ec -in "$keys_dir/private.pem" -pubout -out "$keys_dir/public.pem" 2> /dev/null
  # From here a failed install can be resumed (see "what this run does" in install.sh).
  set_env IDAH_INSTALL_STARTED_AT "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  umask "$saved_umask"
  chmod 644 "$keys_dir/public.pem"
  echo "   $keys_dir/private.pem (iam signs tokens with it)"
  echo "   $keys_dir/public.pem  (the other services verify with it)"
else
  # Kept: a new key would sign everyone out.
  umask "$saved_umask"
  echo "   the signing key in $keys_dir is kept"
fi

# What to tell the user if a later step fails. Settings and secrets are in .env
# by now, so running again carries on.
case "$mode" in
  new|resume)
    retry="After fixing it, run it again. It carries on with the settings, secrets
       and signing key it has:
           ${in_dir}./install.sh
       To start over instead (this deletes the bundled databases):
           ${in_dir}docker compose down -v && rm -f $env_file && rm -rf $keys_dir" ;;
  *)
    retry="After fixing it: ${in_dir}./install.sh --$mode (it can simply run again)" ;;
esac
