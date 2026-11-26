#!/usr/bin/env bash
# Installs Ubuntu packages without recommends, reusing the .deb files a
# previous run saved, so a slow or throttled mirror costs only a cache miss:
#
#   install.sh <deb directory> <exact cache hit: true|false> <package>...
#
# Exact hit: the directory holds every .deb an earlier run on the same runner
# image installed, so dpkg installs them with no network at all. If that fails
# the script falls back to the mirror.
#
# Otherwise: the directory may hold .debs from an older runner image (a
# restore-keys hit). They seed apt's download directory, so apt fetches only
# what changed. Afterwards the directory is rebuilt with exactly the .debs now
# installed, ready to be saved under the new key.

set -euo pipefail

debs=${1:?usage: install.sh <deb directory> <exact cache hit> <package>...}
exact_hit=${2:?usage: install.sh <deb directory> <exact cache hit> <package>...}
shift 2
packages=("$@")
(( ${#packages[@]} )) || { echo "install.sh: no packages given" >&2; exit 2; }

export DEBIAN_FRONTEND=noninteractive

all_installed() {
  local p
  for p in "${packages[@]}"; do
    [[ $(dpkg-query -W -f='${db:Status-Abbrev}' "$p" 2>/dev/null) == ii* ]] || return 1
  done
}

has_debs() { compgen -G "$debs/*.deb" > /dev/null; }

# True when the package in this .deb is installed at exactly its version.
deb_installed() {
  local name version arch
  name=$(dpkg-deb -f "$1" Package)
  version=$(dpkg-deb -f "$1" Version)
  arch=$(dpkg-deb -f "$1" Architecture)
  [[ $arch == all ]] || name="$name:$arch"
  [[ $(dpkg-query -W -f='${db:Status-Abbrev} ${Version}' "$name" 2>/dev/null) == "ii  $version" ]]
}

if [[ $exact_hit == true ]] && has_debs; then
  pending=("$debs"/*.deb)
  echo "::group::Install ${#pending[@]} cached packages"
  echo "(dpkg errors on Pre-Depends in a pass are expected; the next pass retries them.)"
  # dpkg takes the files in name order, so one whose Pre-Depends comes later
  # in the list is refused; each pass retries only those. (apt would order
  # them, but refuses local .debs whose version has an epoch.)
  while (( ${#pending[@]} )); do
    sudo dpkg -i "${pending[@]}" || true
    left=()
    for deb in "${pending[@]}"; do
      deb_installed "$deb" || left+=("$deb")
    done
    (( ${#left[@]} < ${#pending[@]} )) || break
    pending=("${left[@]+"${left[@]}"}")
  done
  echo "::endgroup::"
  if (( ${#pending[@]} == 0 )) && all_installed; then
    echo "Installed from the cache: ${packages[*]}"
    exit 0
  fi
  echo "::warning::Cached packages did not install cleanly; installing from the mirror."
fi

# A private archive directory: it starts with only the cached .debs apt can
# reuse, and no clean-up hook (such as Docker's docker-clean) empties it.
# apt downloads as the _apt user, which must be able to enter it.
archives=$(mktemp -d)
mkdir -p "$archives/partial"
chmod 755 "$archives"
if has_debs; then
  cp "$debs"/*.deb "$archives"/
fi

apt=(sudo apt-get -o Acquire::Retries=3 -o "Dir::Cache::Archives=$archives")
"${apt[@]}" update
"${apt[@]}" install -y --no-install-recommends --fix-broken "${packages[@]}"
all_installed

# Keep the .debs whose exact version is now installed: a seeded .deb apt did
# not use (an older version) is left out.
rm -rf "$debs"
mkdir -p "$debs"
for deb in "$archives"/*.deb; do
  [[ -e $deb ]] || continue
  if deb_installed "$deb"; then
    cp "$deb" "$debs"/
  fi
done
sudo rm -rf "$archives"
echo "Kept $(find "$debs" -name "*.deb" | wc -l) .deb files ($(du -sh "$debs" | cut -f1)) for the cache."
