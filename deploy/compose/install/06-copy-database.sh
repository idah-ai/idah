# shellcheck shell=bash disable=SC2034,SC2154
# Step 6 of 10, --provision only: copy the bundled database to the server .env
# now points at.

# The bundled volume is only read, and the target is empty (step 5 checked),
# so putting the old POSTGRES_* settings back undoes the move.
if $start_empty; then
  say "Starting with empty databases"
  echo "   --start-empty: nothing is copied from the database this install used"
elif $external; then
  # The volume may have been created with other credentials than .env now
  # holds. Local connections in that image are trusted, so any existing role works.
  say "Looking for data to copy over"
  dc stop $services frontend > /dev/null 2>&1 || true
  dc up -d --scale postgres=1 postgres > /dev/null 2>&1 \
    || die "could not start the bundled database to look in it"
  for _ in $(seq 1 30); do
    dc exec -T postgres pg_isready -h 127.0.0.1 -d postgres < /dev/null > /dev/null 2>&1 && break
    sleep 2
  done

  src_user=""
  for candidate in "$pg_user" idah postgres; do
    if dc exec -T postgres psql -U "$candidate" -Atqc "select 1" postgres < /dev/null > /dev/null 2>&1; then
      src_user=$candidate; break
    fi
  done

  if [ -n "$src_user" ] && dc exec -T postgres psql -U "$src_user" -Atqc \
      "select 1 from information_schema.tables where table_name = 'schema_migrations'" idah_iam \
      < /dev/null 2>/dev/null | grep -q 1; then
    echo "   the bundled database has IDAH's data; copying it over"
    echo "   (--start-empty leaves it behind and starts with empty databases)"

    # Client tools from the bundled database's own image, so they can read it.
    pg_image=$(sed -n 's/^ *image: *\(pgvector[^ ]*\)/\1/p' compose.yml | head -1)
    target() { # <database>
      printf 'postgres://%s@%s:%s/%s?sslmode=%s%s' "$pg_user" "$pg_host" "$pg_port" "$1" "$pg_sslmode" "${ca:+&sslrootcert=$ca}"
    }
    run_pg() { # <command...> against the target
      docker run --rm -i -e "PGPASSWORD=$pg_password" --add-host=host.docker.internal:host-gateway \
        ${ca_mount[@]+"${ca_mount[@]}"} "$pg_image" "$@"
    }

    # An older target rejects settings a newer dump writes (17's
    # `SET transaction_timeout` fails on 16), so it gets plain SQL without them.
    major() { # <server_version_num>
      echo $(( ${1:-0} / 10000 ))
    }
    src_major=$(major "$(dc exec -T postgres psql -U "$src_user" -Atqc "show server_version_num" postgres < /dev/null 2>/dev/null | tr -d '\r')")
    tgt_major=$(major "$(run_pg psql -Atqc "show server_version_num" "$(target postgres)" < /dev/null 2>/dev/null | tr -d '\r')")
    older_target=false
    if [ "$tgt_major" -gt 0 ] && [ "$src_major" -gt 0 ] && [ "$tgt_major" -lt "$src_major" ]; then
      older_target=true
      echo "   your server is PostgreSQL $tgt_major, the bundled one is $src_major: copying in a form $tgt_major accepts"
    fi

    # Every table with its row count, to compare both ends after the copy.
    row_counts="select table_name || ':' || (xpath('/row/c/text()',
        query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"

    copy_log=$(mktemp)
    for db in $services; do
      printf "   %-13s" "$db"
      run_pg psql -q "$(target postgres)" -c "CREATE DATABASE idah_$db" < /dev/null > "$copy_log" 2>&1 \
        || die "could not create idah_$db on $pg_host:
       $(tail -2 "$copy_log")
       Does $pg_user have the CREATEDB privilege?"

      copy_failed=false
      if $older_target; then
        dc exec -T postgres pg_dump -U "$src_user" --format=plain --no-owner --no-acl "idah_$db" 2> "$copy_log" \
          | grep -v '^SET transaction_timeout' \
          | run_pg psql -v ON_ERROR_STOP=1 -q "$(target "idah_$db")" >> "$copy_log" 2>&1 \
          || copy_failed=true
      else
        dc exec -T postgres pg_dump -U "$src_user" -Fc "idah_$db" 2> "$copy_log" \
          | run_pg pg_restore --no-owner --no-acl --exit-on-error -d "$(target "idah_$db")" >> "$copy_log" 2>&1 \
          || copy_failed=true
      fi

      if $copy_failed; then
        die "copying idah_$db failed:

$(sed 's/^/       /' "$copy_log" | tail -6)

       The bundled database is untouched: put the old POSTGRES_* settings back
       in $env_file to return to it. To set the new server up without the old
       data instead, add --start-empty."
      fi
      # A restore without errors can still fall short, so compare both ends.
      before=$(dc exec -T postgres psql -U "$src_user" -Atqc "$row_counts" "idah_$db" < /dev/null 2>> "$copy_log")
      after=$(run_pg psql -Atqc "$row_counts" "$(target "idah_$db")" < /dev/null 2>> "$copy_log")
      if [ "$before" != "$after" ]; then
        die "idah_$db did not copy completely. Tables and row counts differ:

       bundled: $(printf '%s' "$before" | tr '\n' ' ')
       copied:  $(printf '%s' "$after" | tr '\n' ' ')

       The bundled database is untouched: put the old POSTGRES_* settings back
       in $env_file to return to it."
      fi
      tables=$(printf '%s' "$before" | grep -c .)
      echo "copied, $tables table$([ "$tables" = 1 ] || echo s) verified"
    done
    rm -f "$copy_log"
    copied=true
  else
    echo "   none: the new databases will start empty"
  fi
fi
