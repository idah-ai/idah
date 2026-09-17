# Deploy

What an on-premise install uses. These files are published as release assets, so
a customer never clones the repository.

The developer environment is separate: `compose.yml` and `compose.override.yml`
at the repository root, with settings in `config/development/`.

## Planned contents

| File | Purpose |
|---|---|
| `install.sh` | The one-line install. Checks Docker, downloads the files below, generates every secret, asks for the public URL, runs the migrations, creates the admin account and starts the stack. |
| `idah.yml` | The stack, pulling published images pinned to one release. Gives each service only the variables it needs, so customers never edit per-service files. |
| `.env.example` | The handful of settings a customer may change, written by `install.sh`. |
| `nginx.conf` | The reverse proxy in front of the services. Already here. |

Customers keep their own changes in a `compose.override.yml` next to `idah.yml`,
so an upgrade can replace `idah.yml` without touching them.

## Still needed before the one-line install works

- **A volume for stored files.** media and sync store files on disk by default
  (`MEDIAS_FILES_ADAPTER` / `SYNC_FILES_ADAPTER` is `file_system` unless set to
  `s3`), under `tmp/storage/production`. `idah.yml` must mount a volume there, or
  the files are lost whenever a container is replaced.
- **A frontend URL set at run time.** `VITE_IDAH_HOST` is currently baked into
  the image at build time, so one published image cannot serve every customer's
  domain.
- **Published images.** The CD workflow (`.github/workflows/cd-app.yml`) now
  publishes `ghcr.io/idah-ai/idah-<service>:<version>` for linux/amd64 and
  linux/arm64 when a version tag is pushed. `idah.yml` will pin those tags.
- **Migrations and first-run setup as a scripted step.** Including the service
  accounts: in `production`, iam's `service_accounts:create` gives each account a
  random password unless one is passed in, so `install.sh` must pass the
  passwords it generated.
