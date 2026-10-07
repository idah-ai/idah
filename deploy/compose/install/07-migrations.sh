# shellcheck shell=bash disable=SC2034,SC2154
# Step 7 of 10: create each service's database if missing, and run its
# migrations. Safe to run again: finished migrations are skipped.

say "Creating databases and running migrations"
for svc in $services; do
  printf "   %-13s" "$svc"
  dc run --rm "$svc" bundle exec rake db:setup db:migrate < /dev/null > /dev/null 2>&1 \
    || die "migrations failed for $svc. To see why:
       ${in_dir}docker compose run --rm $svc bundle exec rake db:setup db:migrate
$($external && printf '%s' "
       With an external database, $pg_user needs the CREATEDB privilege, or the
       idah_* databases must be created in advance and owned by $pg_user.")
       $retry"
  echo "ok"
done
