# shellcheck shell=bash disable=SC2034,SC2154
# Step 9 of 10: start the stack, check every service answers and can reach the
# others, then mark the install finished.

say "Starting IDAH"
# Recreated even if unchanged: after a retry, old containers would still hold
# the key files that were replaced.
dc up -d --force-recreate

# iam's healthcheck rather than nginx's /health: it proves both are up, and
# the checks below need iam.
printf "   waiting for iam"
for _ in $(seq 1 90); do
  if curl -fsS --max-time 2 "http://localhost:$http_port/api/v1/iam/healthcheck" > /dev/null 2>&1; then break; fi
  printf "."; sleep 2
done
curl -fsS --max-time 2 "http://localhost:$http_port/api/v1/iam/healthcheck" > /dev/null 2>&1 \
  || die "iam did not come up. See: ${in_dir}docker compose logs iam"
echo " ready"

# Each service logs in to iam with its own account, over its internal address.
# Catches a wrong URL or password now rather than at the first upload.
say "Checking service-to-service calls"
for svc in $services; do
  printf "   %-13s" "$svc"
  if ! out=$(dc exec -T "$svc" bundle exec rake api:check < /dev/null 2>&1); then
    die "the stack is running, but $svc cannot reach the other services:
       $( { printf '%s\n' "$out" | grep -E '^FAILED' || printf '%s\n' "$out" | grep -v -e COMMON_PATH -e '^/' -e '^Tasks:' -e '^(See'; } | tail -1)
       See: ${in_dir}docker compose logs $svc"
  fi
  echo "ok"
done

# Finished: from now on a plain ./install.sh refuses to run here. The first
# date is kept; --upgrade adds it to installs from before the mark. Owner-only
# umask, since set_env rewrites the file.
if [ -z "$(from_file IDAH_INSTALLED_AT)" ]; then
  ( umask 077; set_env IDAH_INSTALLED_AT "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" )
  chmod 600 "$env_file"
fi
