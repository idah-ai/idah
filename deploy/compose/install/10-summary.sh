# shellcheck shell=bash disable=SC2034,SC2154
# Step 10 of 10: print what was installed, where its data lives, and the
# administrator's password if one was created.

smtp_host=$(get MAIL_SMTP_HOST)

# Built beforehand: bash 3 (macOS) cannot parse a case inside $(...).
tls_note=""
if [ -n "$tls_conf" ]; then
  tls_note=" (HTTPS on port $https_port, from $certs_dir/idah.crt)"
else
  case "$url" in https://*) tls_note=" (TLS terminated in front of port $http_port)" ;; esac
fi
case "$mode" in
  new|resume) outcome=installed ;;
  *) outcome=ready ;;
esac

# An administrator left as it was: its login and password are not ours to print.
if [ -n "$admin_password" ]; then
  account_lines="  Login     $admin_email
  Password  $admin_password"
  password_note="Write the password down now: it is not stored anywhere and cannot be recovered.
Change it after the first login."
else
  account_lines="  Accounts  unchanged: log in as before"
  password_note="Accounts, and every row in the database, are as they were."
fi

# Where uploaded files live, for backups: S3, a directory compose.override.yml
# mounts, or the volume.
files_where() { # <service> <adapter key> <volume> <path in the volume>
  local prefix
  if [ "$(get "$2")" = s3 ]; then
    prefix=$(get "${2%_ADAPTER}_PREFIX"); prefix=${prefix:-${4#/data/}}
    echo "S3, $(get "${2%_ADAPTER}_BUCKET")/$prefix"
  elif [ -f compose.override.yml ] && grep -q ":$4" compose.override.yml; then
    dc config 2> /dev/null | awk -v svc="$1" -v target="$4" '
      /^  [a-z]/ { in_svc = ($1 == svc ":") }
      in_svc && /source:/ { src = $2 }
      in_svc && $1 == "target:" && $2 == target { print src; exit }' | grep . || echo "the ${project}_$3 volume"
  else
    echo "the ${project}_$3 volume"
  fi
}
media_where=$(files_where media MEDIAS_FILES_ADAPTER media_files /data/media/files)
sync_where=$(files_where sync SYNC_FILES_ADAPTER sync_files /data/sync/files)

cat <<SUMMARY

IDAH $version is $outcome.$($copied && printf '\n\nThe bundled database was copied to %s, and its volume is untouched:\nput the old POSTGRES_* settings back in %s to return to it.' "$pg_host:$pg_port" "$env_file")

  URL       $url$tls_note
$account_lines
  Project   $project (its containers and volumes carry this name)
  Database  $($external && echo "$pg_host:$pg_port (sslmode=$pg_sslmode)" || echo "bundled, in the ${project}_postgres_data volume")
  Redis     $($external_redis && echo "$redis_addr" || echo "bundled, in the ${project}_redis_data volume")
  Email     $([ -n "$smtp_host" ] && echo "via $smtp_host" || echo "off until MAIL_SMTP_HOST is set")
  Uploads   $media_where
  Exports   $sync_where

$password_note

Settings live in $env_file and README.md describes them. After changing one:
docker compose up -d. Back up the uploads and exports above along with the
database, $env_file and config/.

  Status    docker compose ps
  Logs      docker compose logs -f
  Stop      docker compose down
SUMMARY
