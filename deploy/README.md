# Deploy

What an on-premise install uses. These files are published as release assets, so
a customer never clones the repository.

The developer environment is separate: `compose.yml` and `compose.override.yml`
at the repository root, with settings in `config/development/`.

## Contents

| File | Purpose |
|---|---|
| `install.sh` | The installer. Generates every secret, prepares the databases and starts the stack. Configures nothing itself: settings come from `.env`. |
| `compose.yml` | The stack, pulling published images pinned to one release. nginx, PostgreSQL and Redis are pinned to exact versions too. |
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

Everything can also be changed after the install. Moving to your own
PostgreSQL is the one that is more than a setting, because the data has to come
along: `./install.sh --provision` does that, and "Moving to your own
PostgreSQL" covers it.

| To | Set in `.env` | When |
|---|---|---|
| Change the public URL | `IDAH_URL` | any time |
| Change the port nginx listens on | `IDAH_HTTP_PORT` (default 8080) | any time |
| Serve HTTPS | `IDAH_URL`, `IDAH_TLS_CONF`, `IDAH_HTTPS_PORT` | any time |
| Send email notifications | `MAIL_SMTP_*` | any time |
| Store files in S3 | `MEDIAS_FILES_*`, `SYNC_FILES_*` | before files are uploaded |
| Report errors to your own Sentry | `SENTRY_*` | any time |
| Use your own PostgreSQL | `POSTGRES_*` | at install, or with `--provision` |
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

- **PostgreSQL 13 or later**, which the installer checks and refuses below.
  IDAH creates `pg_trgm`, `pgcrypto` and `uuid-ossp`, which from 13 on the
  database owner may create without being a superuser — so managed services
  such as RDS or Cloud SQL work. The bundled database is 17, which is the
  version IDAH is tested against.
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

## Upgrading

```bash
# change IDAH_VERSION in .env, then
./install.sh --upgrade
```

It pulls the new images, runs the migrations they bring and restarts the stack.
Every row and every account is kept, and no administrator is touched — it
refuses outright if the database holds no IDAH data. `docker compose up -d`
alone would pull the images but never run the migrations, and the services
would then run against a schema they do not expect.

**Back up first** (see Backups): migrations are not reversible, so going back
to the previous `IDAH_VERSION` afterwards is not supported — the old code would
be running against the new schema. The stack is down while it runs, usually
under a minute.

## Moving to your own PostgreSQL

```bash
# set POSTGRES_HOST and the rest in .env, then
./install.sh --provision
```

It sets up the new server and brings your data with it: the bundled database is
copied over, database by database, before the migrations run. Accounts,
passwords and uploaded files stay as they are — the administrator keeps the
password they already had.

Each database is verified once copied, table by table and row count by row
count, so a copy that lands short stops the move instead of going unnoticed. A
server older than the bundled 17 is handled too: the copy is then made in a
form that version accepts, down to the PostgreSQL 13 the rest of IDAH needs.

```bash
./install.sh --provision --start-empty   # start empty instead
```

`--start-empty` skips the copy, creates empty databases and prints a new
administrator password. Use it when the install has nothing worth keeping. It
leaves the old database alone too — it simply does not read it.

Either way:

- **The old database is left exactly as it was.** It is only read. Putting the
  previous `POSTGRES_*` settings back and running `docker compose up -d`
  returns you to it, data and all.
- **Nothing is dropped**, and a database that already holds IDAH data is
  refused. That is `--upgrade`'s job, or a manual move (below).
- **`.env`, its secrets and the signing key are kept**, so the service accounts
  still match the running services.
- **Uploaded files are not part of this.** They live in the `media_files` and
  `sync_files` volumes and stay where they are, which is what you want when
  copying. After `--start-empty` they are orphans, so remove those volumes too
  for a completely clean start.

### Between two servers of your own

The copy reads the bundled database, so a move from one server of yours to
another is a manual one: stop the seven services and the frontend, `pg_dump`
each `idah_*` database and restore it with `pg_restore --no-owner` (without
that, every object reports an error, since the objects belong to a role the new
server may not have), then point `.env` at the new server and run
`docker compose up -d`.

## Changing an infrastructure version

`nginx`, `postgres` and `redis` are pinned to exact versions in `compose.yml`,
so every install of one IDAH release runs the same stack. A new IDAH release
may raise them; `docker compose up -d` applies the change.

Replacing the database container drops the connections the services hold, so a
request in flight at that moment fails with `PG::ConnectionBad` and the next
one succeeds — the services reconnect by themselves. Upgrading PostgreSQL
within a major version (17.6 to 17.11, say) needs nothing else: the existing
volume is used as it is.

## Backups

Four things, not one:

- **The seven `idah_*` databases.**
- **The `media_files` and `sync_files` volumes**, which hold uploaded media and
  generated exports. They are not in PostgreSQL. (With S3 storage, your bucket
  holds them instead.)
- **`.env`.** It holds the password of the bundled database, which exists
  nowhere else: lose the file and the data in that volume cannot be read.
- **`config/`**, which holds the signing key and any certificates.

With the bundled database, a dump of everything looks like this:

```bash
for db in iam dataset media setting notification sync audit; do
  docker compose exec -T postgres pg_dump -U idah -Fc "idah_$db" > "$db.dump"
done
cp .env env.backup && tar czf config.tar.gz config
```

To restore into a new install, put `.env` and `config/` back, run
`./install.sh --provision --start-empty` to create the databases, then
`pg_restore --no-owner` each dump into them.

## Still needed

- **Publishing these files as release assets**, so the install really is one
  line: download, then run `install.sh`. Publishing sets `release_version` in
  `install.sh` to the release's version; until then the installer asks for it.
