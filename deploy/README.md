# Deploy

What an on-premise install uses. These files are published as release assets, so
a customer never clones the repository.

The developer environment is separate: `compose.yml` and `compose.override.yml`
at the repository root, with settings in `config/development/`.

## Contents

| File | Purpose |
|---|---|
| `install.sh` | The installer. Generates every secret, prepares the databases and starts the stack. Configures nothing itself: settings come from `.env`. |
| `compose.yml` | The stack, pulling published images pinned to one release. |
| `.env.example` | Every setting a customer may change, documented. Copy it to `.env` to configure an install; without one, `install.sh` creates it. |
| `nginx.conf` | The reverse proxy in front of the services, with `routes.conf` for the routes it serves. |
| `tls.conf` | An HTTPS server for `nginx.conf`, from your own certificate. Off unless `IDAH_TLS_CONF` names it. |

Customers keep their own changes in a `compose.override.yml` next to
`compose.yml`. Compose merges it automatically, so an upgrade can replace
`compose.yml` without touching it.

## Installing

```bash
./install.sh
```

It asks two things, the public URL and the administrator's email, and installs
the release it came with, running its own PostgreSQL and Redis. It generates
the signing key pair and every password — one per internal service account —
creates the databases, runs the migrations, creates the accounts and starts the
stack. The administrator's password is printed once and stored nowhere.

To configure anything before installing, create `.env` first and edit it:

```bash
cp .env.example .env
./install.sh
```

The installer keeps every value you set and generates only the empty secrets.
A setting `.env` leaves empty can also come from the environment, which is
handy for scripted installs; the installer writes it into `.env`, so later
`docker compose` commands see it without it being set again:

```bash
IDAH_VERSION=0.0.0-local IDAH_IMAGE_PREFIX=idah- ./install.sh --yes --admin-email you@example.com
```

It checks the images and any server you configured before writing anything,
so a failed check leaves nothing behind. `--yes` asks nothing, for unattended
installs: set `IDAH_URL` in `.env` and pass `--admin-email`.

## Configuration

Every setting is in `.env`, documented where it appears. After the install,
change one and apply it:

```bash
docker compose up -d
```

Nearly everything can also be changed after the install, including TLS and
Redis. The exception is PostgreSQL: pointing IDAH at an empty server leaves it
with no data, so moving there later means dumping and restoring first. See
"Moving to your own PostgreSQL later".

| To | Set in `.env` | When |
|---|---|---|
| Change the public URL | `IDAH_URL` | any time |
| Change the port nginx listens on | `IDAH_HTTP_PORT` (default 8080) | any time |
| Serve HTTPS | `IDAH_URL`, `IDAH_TLS_CONF`, `IDAH_HTTPS_PORT` | any time |
| Send email notifications | `MAIL_SMTP_*` | any time |
| Store files in S3 | `MEDIAS_FILES_*`, `SYNC_FILES_*` | before files are uploaded |
| Report errors to your own Sentry | `SENTRY_*` | any time |
| Use your own PostgreSQL | `POSTGRES_*` | at install, or with a migration |
| Use your own Redis | `REDIS_URL` | any time, when quiet |
| Trust your own certificate authority | `IDAH_CA_CERT` | any time |
| Run images built from source | `IDAH_IMAGE_PREFIX`, `IDAH_VERSION` | any time |

### Email

Off after an install. Uncomment `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`,
`MAIL_SMTP_USER` and `MAIL_SMTP_PASSWORD` and fill them in, then
`docker compose up -d`.

### Serving HTTPS

IDAH serves plain HTTP on `IDAH_HTTP_PORT`, and can serve HTTPS itself from a
certificate you supply. Either way, set `IDAH_URL` to the `https://` address:
the browser app calls its own origin, so `IDAH_URL` is what email links and the
API documentation use.

Browsers treat plain HTTP as an insecure context outside `localhost`, which
disables the Web Crypto and clipboard APIs the frontend uses. Any install
customers reach by host name needs HTTPS, one way or the other.

**With your own certificate**, served by IDAH's nginx. Put the two files in
`config/certs`:

```
config/certs/idah.crt   the certificate, followed by any intermediates
config/certs/idah.key   its private key, not password-protected
```

Then in `.env`:

```bash
IDAH_URL=https://idah.example.com
IDAH_TLS_CONF=./tls.conf
IDAH_HTTPS_PORT=443      # default 8443
IDAH_HTTP_BIND=127.0.0.1 # optional: keep plain HTTP off the network
```

`docker compose up -d` applies it. The installer checks, before writing
anything, that both files are readable, that the certificate and key match, and
that the key needs no passphrase — nginx cannot be prompted for one. Renewal is
yours: replace the two files and run `docker compose restart nginx`.

`tls.conf` holds the nginx TLS settings (TLS 1.2 and 1.3, sessions, the two
file paths). To change them, copy it, edit your copy, and point
`IDAH_TLS_CONF` at that instead — an upgrade replaces `tls.conf` but not your
file.

**With a load balancer or reverse proxy you already have**, leave
`IDAH_TLS_CONF` unset, point the proxy at `http://<host>:8080`, and set:

```bash
IDAH_URL=https://idah.example.com
IDAH_HTTP_BIND=127.0.0.1   # only if the proxy runs on this machine
```

`IDAH_HTTP_BIND` matters: by default the HTTP port accepts connections from
anywhere, so anyone who can reach the machine can bypass your TLS. Bound to
`127.0.0.1` it is reachable only from the machine itself.

nginx forwards `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For`,
and sends HSTS, so a proxy in front is understood.

### Your own PostgreSQL

```bash
POSTGRES_HOST=db.example.com
POSTGRES_USER=idah
POSTGRES_PASSWORD='...'
```

The installer turns off the bundled database and checks the connection.

- **PostgreSQL 13 or later.** IDAH creates `pg_trgm`, `pgcrypto` and `uuid-ossp`,
  which from 13 on the database owner may create without being a superuser —
  so managed services such as RDS or Cloud SQL work.
- **`CREATEDB` for the user**, or the seven `idah_*` databases created in
  advance and owned by it.
- **For a server on the same machine, use `host.docker.internal`.** Inside a
  container `localhost` is the container itself; the installer refuses it.
- **TLS is on by default.** `POSTGRES_SSLMODE=require` encrypts the connection
  without needing a CA, so it works with any server that accepts TLS; set
  `disable` for one that does not. `verify-full` also checks the server's
  identity — its certificate and host name — and needs the CA that signed that
  certificate (see below). For a managed database, that is your provider's CA
  bundle.

### Moving to your own PostgreSQL later

Setting `POSTGRES_HOST` on an install that already has data does not move it.
IDAH stops with `database "idah_iam" does not exist` until the databases are
there. Copy them across first, with IDAH stopped so nothing writes during the
dump:

```bash
docker compose stop iam dataset media setting notification sync audit frontend
docker compose up -d --scale postgres=1 postgres

for db in iam dataset media setting notification sync audit; do
  docker compose exec -T postgres pg_dump -U idah -Fc "idah_$db" > "$db.dump"
done
```

On the new server, create the role and the seven databases, then restore each
one. `--no-owner` matters: the objects belong to the old role, which does not
exist there, and without it every object reports an error.

```bash
for db in iam dataset media setting notification sync audit; do
  psql "postgres://idah@db.example.com/postgres?sslmode=require" -c "CREATE DATABASE idah_$db"
  pg_restore --no-owner -d "postgres://idah@db.example.com/idah_$db?sslmode=require" < "$db.dump"
done
```

Then set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_SSLMODE` and `IDAH_POSTGRES_CONTAINER=0` in `.env`, and:

```bash
docker compose up -d
```

The bundled database stops being started, and its volume stays untouched — keep
it until you are satisfied, then remove it with
`docker volume rm <project>_postgres_data`.

### Your own Redis

```bash
REDIS_URL=rediss://:password@redis.example.com:6379/0
```

The installer turns off the bundled Redis and checks the connection. Every
service uses the same Redis, since it carries the events they send each other.

This can also be changed after the install: set `REDIS_URL` and
`IDAH_REDIS_CONTAINER=0`, then `docker compose up -d`. Nothing needs copying,
since Redis holds cached values and events rather than records, but events in
flight at that moment are lost — do it while the system is quiet.

- **TLS:** `rediss://` connects with TLS and verifies the server's certificate;
  `redis://` is plain, for the many self-hosted servers without TLS.
- **The password is part of the URL.** Any character other than letters,
  digits and `- . _ ~` must be percent-encoded. `./install.sh --encode` asks
  for the password and prints it encoded.
- As with PostgreSQL, use `host.docker.internal` for a server on the same
  machine; `localhost` is refused.

### Your own certificate authority

For TLS to your own PostgreSQL or Redis when their certificates are not signed
by a public CA. Put the CA certificates (PEM, several in one file allowed) at
`config/certs/ca.pem`, then:

```bash
IDAH_CA_CERT=/certs/ca.pem
```

PostgreSQL then trusts only this file, so it must include that server's CA.
Everything else, Redis and public HTTPS alike, keeps trusting the public CAs
too.

TLS to either server can be turned on after the install: change
`POSTGRES_SSLMODE`, or the scheme in `REDIS_URL`, add `IDAH_CA_CERT` if the
certificates are not from a public CA, then `docker compose up -d`. The
installer's connection checks only run at install time, so if a service cannot
connect afterwards, `docker compose logs <service>` says why.

### S3 instead of local storage

Uploaded media and exports go to the `media_files` and `sync_files` volumes.
Setting `MEDIAS_FILES_ADAPTER=s3` (or `SYNC_FILES_ADAPTER=s3`) makes all five of
its settings required; a missing one stops that service at boot with the
variable named. Files already on the volume are not moved.

### Error reporting

Nothing is reported by default. `SENTRY_DSN_FRONTEND` and the per-service
`SENTRY_DSN_*` send errors to your own Sentry project. Session replay records
your users' screens and stays off unless you set its sample rates.

## Backups

Back up the database and the `media_files` and `sync_files` volumes. The volumes
hold uploaded media and generated exports, which are not in PostgreSQL.

## Still needed

- **An upgrade path.** Changing `IDAH_VERSION` and running
  `docker compose up -d` pulls the new images, but nothing runs the new
  migrations.
- **Publishing these files as release assets**, so the install really is one
  line: download, then run `install.sh`. Publishing sets `release_version` in
  `install.sh` to the release's version; until then the installer asks for it.
