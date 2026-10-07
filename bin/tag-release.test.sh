#!/usr/bin/env bash
# Tests for the version rules in bin/tag-release. Run: bin/tag-release.test.sh

set -euo pipefail

# shellcheck source=bin/tag-release
source "$(dirname "$0")/tag-release"

failures=0

check() {
  local name="$1" expected="$2" actual="$3"

  if [ "$expected" == "$actual" ]; then
    echo "ok    $name"
  else
    echo "FAIL  $name: expected '$expected', got '$actual'"
    failures=$((failures + 1))
  fi
}

tags() { printf '%s\n' "$@"; }

check "a candidate compares against the last stable release" \
  "v0.1.0" "$(tags v0.1.0-rc.1 v0.1.0 | previous_stable 0.1.1-rc.1)"
check "a stable release skips its own candidates" \
  "v0.1.0" "$(tags v0.1.0-rc.1 v0.1.0 v0.1.1-rc.1 v0.1.1-rc.2 | previous_stable 0.1.1)"
check "a second candidate compares against the same release" \
  "v0.1.0" "$(tags v0.1.0 v0.1.1-rc.1 | previous_stable 0.1.1-rc.2)"
check "versions compare as numbers, not text" \
  "v0.1.9" "$(tags v0.1.0 v0.1.2 v0.1.9 | previous_stable 0.1.10)"
check "a later minor is not mistaken for an earlier one" \
  "v0.1.1" "$(tags v0.1.0 v0.1.1 v0.10.0 | previous_stable 0.2.0)"
check "a hotfix follows its own minor, even after a newer one" \
  "v0.1.1" "$(tags v0.1.0 v0.1.1 v0.2.0 | previous_stable 0.1.2)"
check "the first release has no previous version" \
  "" "$(tags v0.1.0-rc.1 | previous_stable 0.1.0)"
check "no tags at all" \
  "" "$(printf '' | previous_stable 0.1.0)"

check "the latest candidate is picked by number" \
  "v0.2.0-rc.10" "$(tags v0.2.0-rc.1 v0.2.0-rc.2 v0.2.0-rc.10 | latest_candidate 0.2.0)"
check "candidates of other versions are ignored" \
  "v0.2.0-rc.1" "$(tags v0.2.0-rc.1 v0.2.1-rc.4 v0.20.0-rc.9 | latest_candidate 0.2.0)"
check "no candidate yet" \
  "" "$(tags v0.1.0 | latest_candidate 0.2.0)"

if [ "$failures" -gt 0 ]; then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
