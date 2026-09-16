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

- **File storage without S3.** Outside development, media and sync require the
  `s3` adapter and its settings. A `file_system` adapter on a Docker volume
  already exists for development and should become the on-premise default.
- **A frontend URL set at run time.** `VITE_IDAH_HOST` is currently baked into
  the image at build time, so one published image cannot serve every customer's
  domain.
- **Published images.** `idah.yml` pulls them, so it depends on the CD workflow
  and the version scheme (§02 of the release policy).
- **Migrations and first-run setup as a scripted step.** Including the service
  accounts: in `production`, iam's `service_accounts:create` gives each account a
  random password unless one is passed in, so `install.sh` must pass the
  passwords it generated.
