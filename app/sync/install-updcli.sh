#!/bin/sh

# Optional updcli installer, run as the container entrypoint.
#
# If a read-only mount of the repo's updcli/ dir is present (default /opt/updcli,
# override with UPDCLI_SRC), extract the binary matching the container
# architecture onto PATH as /usr/local/bin/updcli-static. This is a no-op when
# the mount is absent, so the image stays usable with or without updcli, and any
# service that needs updcli just adds the same optional mount.

set -e

UPDCLI_SRC="${UPDCLI_SRC:-/opt/updcli}"
UPDCLI_VERSION="${UPDCLI_VERSION:-v0.1.0}"
TARGET="/usr/local/bin/updcli-static"

if [ ! -x "$TARGET" ] && [ -d "$UPDCLI_SRC/$UPDCLI_VERSION" ]; then
  arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
  case "$arch" in
    amd64 | x86_64) suffix=amd64 ;;
    arm64 | aarch64) suffix=arm64 ;;
    *) echo "updcli: unsupported architecture '$arch'; skipping" >&2; suffix="" ;;
  esac

  tarball="$UPDCLI_SRC/$UPDCLI_VERSION/updcli-linux-$suffix.tar.gz"
  if [ -n "$suffix" ] && [ -f "$tarball" ]; then
    echo "updcli: installing $suffix binary from $tarball"
    tar -xf "$tarball" -C /usr/local/bin
    mv "/usr/local/bin/updcli-linux-$suffix" "$TARGET"
    chmod +x "$TARGET"
  else
    echo "updcli: no tarball at $tarball; skipping" >&2
  fi
fi

exec "$@"
