# Mock External QC App

A simple Sinatra app that simulates an external QC service for testing the `qc-workflow` plugin.

## Prerequisites

- Ruby 3.x (same as IDAH)
- Bundler
- An IDAH API key with appropriate permissions to update entries and create note feeds (for authenticated callbacks)

## Setup

```bash
cd mock-qc-app
bundle install
```

## Running

### Without authentication (for quick dev testing)

```bash
bundle exec puma config.ru -p 4567 -b tcp://0.0.0.0
```

The app will start on `http://localhost:4567`. Callbacks to IDAH will be unauthenticated.

### With API key authentication (recommended for production)

First, create an API key in IDAH via the UI (`/api-keys`) or the IAM API. Then start the app:

```bash
IDAH_API_KEY="IDAH_your_api_key_here" bundle exec puma config.ru -p 4567 -b tcp://0.0.0.0
```

The app logs in to IDAH on startup and stores the JWT. All subsequent callback requests include `Authorization: Bearer <token>`, allowing the `workflow_callback` endpoint to enforce standard authentication.

To use a custom IDAH URL (default: `https://idah.localhost:8443`):

```bash
IDAH_URL="https://my-idah.example.com" IDAH_API_KEY="IDAH_..." bundle exec puma config.ru -p 4567 -b tcp://0.0.0.0
```

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | POST | Receives annotation data from IDAH (called by `QcClient`) |
| `/status` | GET | Returns stored data info |
| `/trigger-callback` | POST | Simulates the QC app calling back to IDAH |
| `/health` | GET | Health check |

## How to test end-to-end

### 1. Start both services

```bash
# Terminal 1 — Mock QC app (on host)
cd mock-qc-app && bundle exec puma config.ru -p 4567 -b tcp://0.0.0.0

# Terminal 2 — IDAH services (via docker-compose)
docker compose up -d dataset
```

### 2. Configure a dataset

Create a dataset with:
- `workflow_name: "qc-annotation-workflow"`
- `workflow_configuration`:
  ```json
  {
    "qc": {
      "endpoint": "http://host.docker.internal:4567/",
      "callback_token": "test-token"
    }
  }
  ```

The dataset service container can reach the host machine via `host.docker.internal`.

### 3. Add entries and annotate

- Add an entry to the dataset
- Create annotations on the entry
- Submit the entry (`POST /entries/:id/submit`)

### 4. Check the mock app received data

```bash
curl http://localhost:4567/status
```

### 5. Trigger the callback

```bash
curl -X POST http://localhost:4567/trigger-callback
```

This will POST back to IDAH's `workflow_callback` endpoint, which will:
- Update annotations with `qc_score` and `qc_checked` metadata
- Create a note feed with QC feedback
- Advance the entry from `qc` to `review` step

### 6. Verify in IDAH

Fetch the entry — `wf_step` should be `review` and the QC note should appear.

## Network diagram

```
┌─────────────────────────┐          ┌──────────────────────┐
│  Docker container       │          │  Host machine         │
│  dataset service        │          │  mock-qc-app          │
│                         │          │  port 4567            │
│  QcClient.call(entry)   │ ──────►  │  POST /               │
│  (fire-and-forget POST) │          │  (receives data)      │
│                         │          │                       │
│  POST /entries/:id/     │ ◄──────  │  POST /trigger-callback│
│  workflow_callback      │          │  (simulates QC done)   │
│  port 8443 (nginx)       │          │                       │
└─────────────────────────┘          └──────────────────────┘
```