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

# Check runs as gh prints them: name, status and conclusion, tab-separated.
runs() { printf '%s\t%s\t%s\n' "$@"; }
all_passed() {
  runs "App CI passed" completed success "Common CI passed" completed success \
    "Plugins CI passed" completed success "Scripts CI passed" completed success
}

check "a commit whose CI passed can be tagged" \
  "" "$(all_passed | ci_problems)"
check "other checks, such as Dependabot's, do not count" \
  "" "$({ all_passed; runs Dependabot completed failure; } | ci_problems)"
check "a failed gate stops the tag" \
  "App CI passed: failure" \
  "$(all_passed | sed 's/^App CI passed\tcompleted\tsuccess$/App CI passed\tcompleted\tfailure/' | ci_problems)"
check "a gate still running stops the tag" \
  "Scripts CI passed is still running" \
  "$({ all_passed | grep -v '^Scripts'; runs "Scripts CI passed" in_progress ""; } | ci_problems)"
check "a commit CI never ran on stops the tag" \
  "$(printf '%s\n' "App CI passed has not run on this commit" "Common CI passed has not run on this commit" \
    "Plugins CI passed has not run on this commit" "Scripts CI passed has not run on this commit")" \
  "$(printf '' | ci_problems)"

if [ "$failures" -gt 0 ]; then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
