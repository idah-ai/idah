# shellcheck shell=bash disable=SC2034,SC2154
# Step 5 of 10: start the bundled PostgreSQL and Redis. With --upgrade or
# --provision, check the database holds what the flag expects.

bundled=""
$external || bundled="postgres"
$external_redis || bundled="$bundled redis"
if [ -n "$bundled" ]; then
  say "Starting the bundled services:$(printf ' %s' $bundled)"
  dc up -d $bundled
fi

if ! $external; then
  # The container's restart count. It restarts on its own (restart: always),
  # so a count that goes up while waiting means PostgreSQL crashed: stop then
  # rather than wait out the two minutes. Counted from here, as a container
  # kept from a failed run may have restarted before.
  pg_restarts() {
    docker inspect -f '{{.RestartCount}}' "$(dc ps -aq postgres 2> /dev/null | head -1)" 2> /dev/null || echo 0
  }
  restarts_before=$(pg_restarts)
  crashed=false

  # Checked over TCP: on a new volume, PostgreSQL first runs a temporary
  # socket-only server that would pass a socket check just before restarting.
  printf "   waiting for PostgreSQL"
  for _ in $(seq 1 60); do
    if dc exec -T postgres pg_isready -h 127.0.0.1 -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1; then break; fi
    if [ "$(pg_restarts)" -gt "$restarts_before" ]; then crashed=true; break; fi
    printf "."; sleep 2
  done
  if $crashed || ! dc exec -T postgres pg_isready -h 127.0.0.1 -U "$pg_user" -d postgres < /dev/null > /dev/null 2>&1; then
    echo
    # Its own last words, so the cause is in the message.
    pg_log=$(dc logs --no-log-prefix --tail 30 postgres 2> /dev/null | grep -v '^[[:space:]]*$' | tail -6 | sed 's/^/           /' || true)
    die "PostgreSQL $($crashed && echo "stopped while starting" || echo "did not become ready"). Its last log lines:
${pg_log:-           (none)}
       More: ${in_dir}docker compose logs postgres
       $retry"
  fi
  echo " ready"
fi

# --upgrade needs IDAH's schema in the database; --provision needs it absent.
# Checked from the iam image, with the services' own connection settings.
case "$mode" in
  upgrade|provision)
    where=$($external && echo "$pg_host:$pg_port" || echo "the bundled postgres")
    say "Looking at the database"
    if dc run --rm iam bundle exec ruby -e '
          require "sequel"
          begin
            Sequel.connect(ENV.fetch("DATABASE_URI")) { |db| exit db.table_exists?(:schema_migrations) ? 0 : 1 }
          rescue Sequel::DatabaseConnectionError
            exit 1 # no database yet, so nothing in it
          end' < /dev/null > /dev/null 2>&1; then
      [ "$mode" = upgrade ] || die "the database at $where already has IDAH data in it.

       To run the migrations a new IDAH_VERSION brings, keeping every row:
           ./install.sh --upgrade

       --provision is for a database with no IDAH data in it, and it brings the
       data of this install with it; see \"Moving to your own PostgreSQL\" in
       README.md."
      echo "   IDAH's schema is there; the data in it is kept"
    else
      [ "$mode" = provision ] || die "there is no IDAH data in the database at $where.

       --upgrade migrates a database that already has it. To set this one up
       from scratch, with fresh databases and accounts:
           ./install.sh --provision"
      echo "   empty, ready to be set up"
    fi ;;
esac
