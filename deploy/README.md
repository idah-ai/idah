# Deploy

What an on-premise install uses. These files are published as release assets, so
a customer never clones the repository.

The developer environment is separate: `compose.yml` and `compose.override.yml`
at the repository root, with settings in `config/development/`.

## Contents

| File | Purpose |
|---|---|
| `idah.yml` | The stack, pulling published images pinned to one release. Gives each service only the variables it needs, so customers never edit per-service files. |
| `.env.example` | The settings a customer may change. Copy to `.env` beside `idah.yml`. |
| `nginx.conf` | The reverse proxy in front of the services. |
| `install.sh` | The one-line install. **Not written yet** — see below. |

Customers keep their own changes in a `compose.override.yml` next to `idah.yml`,
so an upgrade can replace `idah.yml` without touching them.

## Running it by hand

Until `install.sh` exists:

```bash
cp .env.example .env          # then fill in IDAH_VERSION, IDAH_URL and the secrets
mkdir -p config/keys          # put private.pem and public.pem here (EC keys)
docker compose -f idah.yml run --rm iam bundle exec rake db:setup db:migrate
docker compose -f idah.yml up -d
```

Repeat the migration line for each of the seven Ruby services; each one owns its
own database.

Uploaded files live on the `media_files` and `sync_files` volumes. **Back those
up** — they hold customer data that is not in PostgreSQL.

## Still needed before the one-line install works

- **`install.sh` itself.** Checks Docker, downloads the files here, generates the
  EC key pair and every secret, asks for the public URL, runs the migrations,
  creates the admin account and starts the stack.
- **First-run setup as a scripted step.** Including the service accounts: in
  `production`, iam's `service_accounts:create` gives each account a random
  password unless one is passed in, so `install.sh` must pass the
  `IDAH_SERVICE_PASSWORD` it generated.
- **A proven upgrade path.** Changing `IDAH_VERSION` pulls new images, but
  nothing runs the new migrations yet.
- ~~**A volume for stored files.**~~ Done: `media_files` and `sync_files`, with
  `MEDIAS_FILES_PATH` and `SYNC_FILES_PATH` pointing at `/data/files` so durable
  data does not live under a directory named `tmp`.
- ~~**A frontend URL set at run time.**~~ Done: the app calls `/api/v1/<service>`
  on its own origin, so one image serves every domain. nginx must front both the
  frontend and the services, which `nginx.conf` already does.
- ~~**Published images.**~~ Done: `.github/workflows/cd-app.yml` publishes
  `ghcr.io/idah-ai/idah-<service>:<version>` for linux/amd64 and linux/arm64 when
  a version tag is pushed, and `idah.yml` pins them through `IDAH_VERSION`.
