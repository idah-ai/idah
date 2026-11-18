# shellcheck shell=bash disable=SC2034,SC2154
# Helpers the steps share. Sourced by install.sh before step 1.
# (die, say and ask live in install.sh, which needs them before downloading.)

# KEY's value in this shell, empty if unset. eval rather than ${!KEY}, which
# bash 3 (macOS) handles differently.
from_env() { # <key>
  eval "printf '%s' \"\${$1:-}\""
}

# KEY's value in the settings file: the last KEY= line, without its quotes.
# Commented-out lines don't count.
from_file() { # <key>
  local v
  v=$(sed -n "s/^$1=//p" "$settings" | tail -1)
  case "$v" in
    \'*\') v=${v#\'}; v=${v%\'} ;;
    \"*\") v=${v#\"}; v=${v%\"} ;;
  esac
  printf '%s' "$v"
}

# The value the install uses: from the file, else from the environment.
get() { # <key>
  local v
  v=$(from_file "$1")
  [ -n "$v" ] || v=$(from_env "$1")
  printf '%s' "$v"
}

# A random alphanumeric secret, safe in a URI, in .env and in svc:password
# lists. `cut` rather than `head -c`, which would trip pipefail.
secret() {
  n=${1:-32}
  openssl rand -base64 $((n * 3)) | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-"$n"
}

# Sets KEY in .env: replaces its line, uncomments "# KEY=", or appends it.
# The value goes through ENVIRON because awk -v would interpret backslashes.
set_env() { # <key> <value>
  KEY=$1 VAL=$2 awk '
    BEGIN { key = ENVIRON["KEY"]; line = key "=" ENVIRON["VAL"] }
    !done && ($0 ~ ("^" key "=") || $0 ~ ("^# " key "=")) { print line; done = 1; next }
    { print }
    END { if (!done) print line }
  ' "$env_file" > "$env_file.tmp" && mv "$env_file.tmp" "$env_file"
}

# Single-quotes a value unless it is plain, so compose reads it back intact.
quote() { # <value>
  case "$1" in
    *[!A-Za-z0-9_.:/@=+-]*) printf "'%s'" "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

# No -f, so compose also merges compose.override.yml.
dc() { docker compose "$@"; }
