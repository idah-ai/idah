#!/usr/bin/env bash
# Builds the installer bundle a release publishes, from deploy/compose/:
#
#   .github/scripts/build-bundle.sh <version> <output directory>
#
# writes into the output directory:
#
#   idah-<version>/          the unpacked bundle
#   idah-<version>.tar.gz    the bundle a customer downloads
#   install.sh               the installer, for the one-line install
#   SHA256SUMS               checksums of the two files above
#
# The installer is stamped with the version, so it installs that release and
# downloads the matching bundle when run on its own.

set -euo pipefail

version=${1:?usage: build-bundle.sh <version> <output directory>}
out=${2:?usage: build-bundle.sh <version> <output directory>}
root="$(cd "$(dirname "$0")/../.." && pwd)"
bundle="idah-$version"

mkdir -p "$out/$bundle/config/nginx" "$out/$bundle/install"
cp "$root/deploy/compose/compose.yml" "$root/deploy/compose/.env.example" \
   "$root/deploy/compose/README.md" "$out/$bundle/"
cp "$root"/deploy/compose/config/nginx/*.conf "$out/$bundle/config/nginx/"
cp "$root"/deploy/compose/install/*.sh "$out/$bundle/install/"

sed "s/^release_version=\"\"$/release_version=\"$version\"/" \
  "$root/deploy/compose/install.sh" > "$out/$bundle/install.sh"
grep -q "^release_version=\"$version\"$" "$out/$bundle/install.sh" \
  || { echo "could not stamp the version into install.sh" >&2; exit 1; }
chmod +x "$out/$bundle/install.sh"

tar -czf "$out/$bundle.tar.gz" -C "$out" "$bundle"
cp "$out/$bundle/install.sh" "$out/install.sh"

cd "$out"
if command -v sha256sum > /dev/null; then
  sha256sum "$bundle.tar.gz" install.sh > SHA256SUMS
else
  shasum -a 256 "$bundle.tar.gz" install.sh > SHA256SUMS
fi
