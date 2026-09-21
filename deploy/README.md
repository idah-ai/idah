# Deploy

What an on-premise install uses. These files are published as release assets, so
a customer never clones the repository.

The developer environment is separate: `compose.yml` and `compose.override.yml`
at the repository root, with settings in `config/development/`.

## Contents

| File | Purpose |
|---|---|
| `install.sh` | The installer. Generates every secret, prepares the databases and starts the stack. |
| `compose.yml` | The stack, pulling published images pinned to one release. Gives each service only the variables it needs. |
| `.env.example` | Every setting a customer may change, documented. `install.sh` copies it to `.env` and fills in the values. |
| `nginx.conf` | The reverse proxy in front of the services. |

Customers keep their own changes in a `compose.override.yml` next to
`compose.yml`. Compose merges it automatically, so an upgrade can replace
`compose.yml` without touching it.

## Installing

```bash
./install.sh
```

It asks for the public URL, the administrator's email, the version, SMTP
(optional), and whether to use the bundled PostgreSQL and Redis or your own. It then generates the signing key pair and
every password — one per internal service account — creates the databases, runs
the migrations, creates the accounts and starts the stack. The administrator's
password is printed once and stored nowhere.

Every question has a flag, so it also runs unattended; `./install.sh --help`
lists them. The images and the database connection are checked before anything
is written, so a failed install leaves nothing behind.

## Using your own PostgreSQL

```bash
./install.sh --postgres-host db.example.com --postgres-user idah \
             --postgres-password '...' --postgres-sslmode require
```

Or answer "no" to "Use the bundled PostgreSQL?". Requirements:

- **PostgreSQL 13 or later.** IDAH creates `pg_trgm`, `pgcrypto` and `uuid-ossp`,
  which from 13 on the database owner may create without being a superuser —
  so managed services such as RDS or Cloud SQL work.
- **`CREATEDB` for the user**, or the seven `idah_*` databases created in
  advance and owned by it.
- **For a server on the same machine, use `host.docker.internal`.** Inside a
  container `localhost` is the container itself; the installer refuses it.
- **TLS:** `require` encrypts the connection. `verify-full` also checks the
  server's identity — its certificate and host name — and needs the CA that
  signed that certificate: `--ca-cert FILE`. For a managed database, that is
  your provider's CA bundle.

## Using your own Redis

```bash
./install.sh --redis-host redis.example.com --redis-password '...' --redis-tls
```

Or answer "no" to "Use the bundled Redis?". Every service must use the same
Redis, since it carries the events they send each other. The installer
percent-encodes the password into `REDIS_URL`, so any character works.
`--redis-tls` (`rediss://`) verifies the server's certificate: managed services
work as they are, and for a certificate from your own CA pass it with
`--ca-cert FILE`.
As with PostgreSQL, use `host.docker.internal` for a server on the same
machine; `localhost` is refused.

## Backups

Back up the database and the `media_files` and `sync_files` volumes. The volumes
hold uploaded media and generated exports, which are not in PostgreSQL.

## Still needed

- **An upgrade path.** Changing `IDAH_VERSION` and running
  `docker compose up -d` pulls the new images, but nothing runs the new
  migrations.
- **Publishing these files as release assets**, so the install really is one
  line: download, then run `install.sh`.
