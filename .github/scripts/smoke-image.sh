#!/usr/bin/env bash
# Smoke-test an IDAH image the way a customer runs it: the image and its
# settings, no source tree. This is the release gate in cd-app.yml, and it runs
# the same way locally.
#
#   .github/scripts/smoke-image.sh <service> <image> [expected-version]
#
# expected-version defaults to 0.0.0-dev, what an unstamped build reports.
#
# Ruby services need PostgreSQL (postgres/postgres) on port 5432 and Redis on
# port 6379 of the machine running Docker. Containers reach them through
# host.docker.internal, which works on a GitHub runner and on Docker Desktop.
set -euo pipefail

service=${1:?usage: smoke-image.sh <service> <image> [expected-version]}
image=${2:?usage: smoke-image.sh <service> <image> [expected-version]}
expected_version=${3:-0.0.0-dev}

container=""
failed=0
log_file=$(mktemp)

cleanup() {
  if [ -n "$container" ]; then
    if [ "$failed" = 1 ]; then
      echo "--- last container logs"
      docker logs "$container" 2>&1 | tail -40 || true
    fi
    docker rm -f "$container" > /dev/null 2>&1 || true
  fi
  rm -f "$log_file"
}
trap cleanup EXIT

fail() {
  failed=1
  echo "FAIL [$service]: $*" >&2
  exit 1
}

pass() {
  echo "ok   [$service]: $*"
}

# Starts the image in the background on a random host port.
start_container() {
  container=$(docker run -d --add-host=host.docker.internal:host-gateway -p 0:3000 "$@" "$image")
  port=$(docker port "$container" 3000/tcp | awk -F: 'NR == 1 { print $NF }')
}

# GETs a path once the service answers; prints the HTTP status.
http_status() {
  curl --silent --output /dev/null --write-out "%{http_code}" \
    --retry 30 --retry-delay 2 --retry-all-errors "http://localhost:$port$1"
}

echo "== $service: $image (expecting version $expected_version)"
docker pull --quiet "$image" > /dev/null 2>&1 || true

if [ "$service" = frontend ]; then
  start_container
  status=$(http_status /) || true
  [ "$status" = 200 ] || fail "GET / answered $status"
  pass "serves / with 200"
  exit 0
fi

key=public.dev.pem
[ "$service" = iam ] && key=private.dev.pem

env_args=(
  -e APP_ENVIRONMENT=production
  -e LOG_SHOW_ERROR_DETAILS=false
  -e "DATABASE_URI=postgres://postgres:postgres@host.docker.internal:5432/idah_${service}_smoke"
  -e REDIS_STREAM_URL=redis://host.docker.internal:6379/15
  -e "SERVICE_JWT_KEY=file:./config/keys/$key"
  -e "IDAH_SERVICE_ACCOUNT=$service@services.idah.ai"
  -e IDAH_SERVICE_PASSWORD=smoke
  -e IDAH_URL=http://localhost:8080
  # Required by notification's config.yml at boot; never used by this test.
  -e MAIL_SMTP_HOST=localhost -e MAIL_SMTP_PORT=25
  -e MAIL_SMTP_USER=smoke -e MAIL_SMTP_PASSWORD=smoke
)
# media and sync run with their default storage, files on disk.

# 1. Migrations run as a one-off command, the way an operator runs them.
if ! docker run --rm --add-host=host.docker.internal:host-gateway "${env_args[@]}" \
    "$image" bundle exec rake db:setup db:migrate > "$log_file" 2>&1; then
  # The cause is usually near the top; the tail is mostly the shutdown trace.
  echo "--- errors" >&2
  grep -E "Error|FATAL|must be" "$log_file" | grep -v "^\s*/" | head -10 >&2 || true
  echo "--- last lines" >&2
  tail -15 "$log_file" >&2
  fail "migrations failed"
fi
pass "migrations ran"

# 2. The service boots and answers /healthcheck with the stamped version.
start_container "${env_args[@]}"
body=$(curl --silent --show-error --fail-with-body \
  --retry 30 --retry-delay 2 --retry-all-errors "http://localhost:$port/healthcheck") \
  || fail "/healthcheck did not answer 200: ${body:-no response}"

version=$(jq -r .version <<< "$body")
[ "$version" = "$expected_version" ] || fail "reports version $version, expected $expected_version"
pass "healthcheck reports version $version ($(jq -r .revision <<< "$body"))"

for dependency in sequel redis; do
  [ "$(jq -r --arg d "$dependency" '.[$d]' <<< "$body")" = OK ] || fail "$dependency is not OK: $body"
done
pass "database and redis are reachable"

# 3. Plugins shipped inside the image load, and setting serves their bundles.
# Ruby buffers its log output when it is not writing to a terminal, so a line
# can reach `docker logs` a little after the service already answers requests.
expect_log() {
  for _ in $(seq 1 30); do
    if docker logs "$container" 2>&1 | grep -qF "$1"; then
      pass "logged: $1"
      return
    fi
    sleep 1
  done
  fail "missing log line after 30s: $1"
}

expect_no_log() {
  if docker logs "$container" 2>&1 | grep -qF "$1"; then
    fail "unexpected log line: $(docker logs "$container" 2>&1 | grep -F "$1" | head -1)"
  fi
  pass "did not log: $1"
}

case "$service" in
  media)
    expect_log "Starting plugin idah-image"
    expect_log "Starting plugin idah-video"
    ;;
  dataset)
    expect_log "Starting plugin idah-video"
    ;;
  setting)
    status=$(http_status /plugins/idah-video/files/plugin.js) || true
    [ "$status" = 200 ] || fail "plugin bundle answered $status"
    pass "serves the idah-video plugin bundle"
    ;;
esac

# The plugins' idahVersion check must understand the stamped version, including
# release candidates such as 0.4.0-rc.1. idah-video is handled last, so once
# its line has been logged any compatibility warning would have been too.
case "$service" in
  media | dataset | setting | sync)
    case "$service" in
      media | dataset) expect_log "Starting plugin idah-video" ;;
      setting | sync) expect_log "Plugin \`idah-video\` backend path" ;;
    esac
    expect_no_log "compatibility check failed"
    ;;
esac

# 4. The optional S3 storage loads when selected. Starting only validates the
#    settings and builds the client; nothing connects to them.
case "$service" in
  media | sync)
    prefix=MEDIAS_FILES
    [ "$service" = sync ] && prefix=SYNC_FILES
    if ! docker run --rm --add-host=host.docker.internal:host-gateway "${env_args[@]}" \
        -e "${prefix}_ADAPTER=s3" -e "${prefix}_ENDPOINT=http://localhost:9000" \
        -e "${prefix}_REGION=us-east-1" -e "${prefix}_BUCKET=smoke" \
        -e "${prefix}_ACCESS_KEY_ID=smoke" -e "${prefix}_SECRET_ACCESS_KEY=smoke" \
        "$image" bundle exec rake environment > "$log_file" 2>&1; then
      echo "--- errors" >&2
      grep -E "Error|FATAL|must be" "$log_file" | grep -v "^\s*/" | head -10 >&2 || true
      fail "the S3 storage adapter does not load"
    fi
    pass "the S3 storage adapter loads when selected"
    ;;
esac
