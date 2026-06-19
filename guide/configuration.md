# Configuration & Environment Variables

## Configuration Files
- `config.yml` — base config (shared across environments)
- `config.development.yml` — dev overrides
- `config.test.yml` — test overrides
- Loaded via Verse config system, boot.rb

## Shared Environment Variables

| Variable | Purpose |
|----------|---------|
| IDAH_URL | Base URL for inter-service API calls |
| IDAH_SERVICE_ACCOUNT | Service account email for inter-service auth |
| IDAH_SERVICE_PASSWORD | Service account password |
| SERVICE_JWT_KEY | EC P-256 private key (PEM content or file:/path) |
| DATABASE_URI | PostgreSQL connection string |
| REDIS_STREAM_URL | Redis connection string |
| LOG_LEVEL | Logging level (info/debug) |
| LOG_SHOW_ERROR_DETAILS | Detailed errors in HTTP responses |
| PORT | HTTP port (default: 3000) |
| PUMA_WORKERS | Puma worker count |
| PUMA_THREADS | Puma thread count |
| IDAH_PLUGIN_PATH | Glob for plugin discovery (default: plugins/**, supports ;-separated paths) |
| IDAH_JOBS_CONCURRENCY | Job processing concurrency (media/sync) |
| GC_COMPACT_CRON_RULE | Cron schedule for GC compaction |

## Service-Specific Variables

| Service | Variable | Purpose |
|---------|----------|---------|
| iam | IDAH_AUTH_COOKIE_NAME | Auth cookie name |
| iam | IDAH_AUTH_TOKEN_EXP | Token expiration (seconds) |
| iam | IDAH_REFRESH_TOKEN_EXP | Refresh token expiration (seconds) |
| media | S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY | S3 storage |
| media | IDAH_FFMPEG_PATH, IDAH_FFPROBE_PATH | FFmpeg paths |
| media | IDAH_DECODING_THREADS, IDAH_ENCODING_THREADS | Video processing threads |
| notification | SMTP_* variables | SMTP server settings |
| frontend | VITE_IDAH_HOST | Backend API base URL |

## Configuration Pattern
YAML config files use Verse's config system with environment overrides. Each service loads its config via `config/boot.rb`:
```ruby
require "dotenv/load"
require_relative "../config/boot"
```

Initializers in `config/initializers/` load runtime configuration (JWT keys, Shrine storage, SMTP settings, plugin path).
