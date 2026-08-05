# IDAH - Ingedata Annotation Hub

[![CI](https://github.com/idah-ai/idah/actions/workflows/ci.yml/badge.svg)](https://github.com/idah-ai/idah/actions/workflows/ci.yml)
[![CI - Docs](https://github.com/idah-ai/idah/actions/workflows/ci-docs.yml/badge.svg)](https://github.com/idah-ai/idah/actions/workflows/ci-docs.yml)
[![License](https://img.shields.io/badge/license-FSL-blue)](LICENSE.md)
[![Docker](https://img.shields.io/badge/docker-supported-2496ED?logo=docker&logoColor=white)](compose.yaml)

**An open-source platform for collaborative data annotation**, designed to streamline the creation of high-quality training datasets for machine learning models.

🌐 **[Website](https://idah.ai)** | 📚 **[Documentation](https://docs.idah.ai)** | 🚀 **[Getting Started](https://docs.idah.ai/getting-started/about/)** | 🔌 **[Plugin Development](https://docs.idah.ai/plugin/)**

---

## ✨ Key Features

- **Multi-Modal Support** - Images, videos, audio, text, and custom data types
- **Collaborative Workflows** - Team-based annotation with role management and review processes
- **Extensible Plugin System** - Custom annotation tools, media processors, and exporters
- **Enterprise-Ready** - Audit logging, compliance tracking, microservices architecture

[Learn more about features →](https://docs.idah.ai/getting-started/key-features/)

---

## 🚀 Quick Start

### Prerequisites

- **[Docker](https://docs.docker.com/get-docker/)** - Container platform
- **[Docker Compose](https://docs.docker.com/compose/install/)** - Multi-container orchestration
- **[Git](https://git-scm.com/downloads)** - Version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/idah-ai/idah.git
   cd idah
   ```

2. **Start databases** (PostgreSQL & Redis)
   ```bash
   docker compose -f docker-compose-db.yml up -d
   ```

3. **Start IDAH services**
   ```bash
   docker compose up -d --build
   ```

4. **Initialize setup** (first time only)
   ```bash
   docker compose exec iam bundle exec rake dev:setup dev:users
   ```

5. **Access IDAH**

   Open your browser: **[https://idah.localhost:8443](https://idah.localhost:8443)**

   **Default Admin Credentials:**
   - Email: `admin@idah.ai`
   - Password: `P@ssword01`

🎉 **That's it!** IDAH is now running on your machine.

---

## ⚠️ Security Notice

**Development Environment:** The development configuration includes default credentials for ease of setup. These are **ONLY for local development**:

- Database: `postgres:postgres`
- Admin: `admin@idah.ai` / `P@ssword01`
- Dev SSL certificates are self-signed
- JWT signing keys are for development only

**⚠️ DO NOT use these credentials in production or staging environments.**

For production deployment, ensure you:
1. Generate unique, strong passwords and secrets
2. Use proper SSL certificates from a trusted CA
3. Configure secure environment variables
4. Generate new JWT signing keys
5. Follow the [Security Best Practices](SECURITY.md) guide

---

## 📖 Documentation

For detailed information, visit **[docs.idah.ai](https://docs.idah.ai)**:

- **[Installation Guide](https://docs.idah.ai/install/)** - Detailed setup instructions
- **[Database Configuration](https://docs.idah.ai/install/databases/)** - PostgreSQL & Redis setup options
- **[Storage Configuration](https://docs.idah.ai/install/storage/)** - S3-compatible storage setup
- **[Plugin Development](https://docs.idah.ai/plugin/)** - Create custom plugins
- **[API Reference](https://docs.idah.ai/apis/)** - Complete API documentation

---

## 🏗️ Architecture

IDAH follows a **microservices architecture**:

```
idah/
├── app/
│   ├── frontend/         # Web UI (SvelteKit)
│   ├── iam/             # Identity & Access Management
│   ├── dataset/         # Dataset management service
│   ├── media/           # Media processing service
│   ├── sync/            # Data export & sync service
│   ├── notification/    # Notification service
│   ├── audit/           # Audit logging service
│   └── setting/         # Settings management
├── common/              # Shared code & utilities
├── plugins/            # Production plugins
└── plugins_dev/        # Plugin development tools
```

[Learn more about architecture →](https://docs.idah.ai/getting-started/about/#architecture)

---

## 🔧 Common Commands

### View running services
```bash
docker compose ps
```

### View logs
```bash
docker compose logs -f
docker compose logs -f frontend  # Specific service
```

### Stop services
```bash
docker compose down
```

### Restart services
```bash
docker compose restart
docker compose restart frontend  # Specific service
```

### Rebuild after code changes
```bash
docker compose up -d --build
```

---

## 🌍 Environments (dev / staging / prod)

The stack is defined once in **`compose.yaml`** (base) and specialized per environment
by small overlays that only hold the differences:

| Environment | Command | Notes |
|-------------|---------|-------|
| **dev**     | `docker compose up -d --build` | `compose.override.yaml` is applied automatically: `development` image stage, source bind-mounted for hot reload, MailHog, host DBs. |
| **staging** | `docker compose -f compose.yaml -f compose.staging.yaml up -d --build` | Prod-faithful: `production` image stage, no source mounts, bundled Postgres/Redis. Pinned to the `staging` Compose project so `staging_*` volumes are reused. |
| **prod**    | `docker compose -f compose.yaml -f compose.prod.yaml up -d --build` | Scaffold — fill in `config/production/envs/*` and `prod/*` before deploying. |

Each service selects its stage via `build.target` (`development` or `production`) in
its overlay; the multi-stage `Dockerfile`s live next to each service.

### Environment variables

Env files live under **`config/<env>/envs/`** and are loaded via `env_file:` in each
overlay. Real values for `staging`/`prod` are git-ignored; copy the committed
`.env.example` templates and fill them in. Dev defaults are committed
(`config/dev/envs/.env.common`).

### Database migrations

Each service owns its database. Production images run puma directly and do **not**
migrate on boot — run migrations explicitly as a deploy step:

```bash
bin/migrate staging   # or: bin/migrate prod
```

(For local development, use `bin/dev migrate`.)

First-time databases still need a one-off `rake db:setup` per service.

### Build contexts & `.dockerignore`

One rule: **the `.dockerignore` lives next to whatever `context:` points at.**
Each service builds from its own `./app/<service>` folder with its own
`app/<service>/.dockerignore`. The **only** repo-root-context build is the frontend
production image (it needs the shared `plugins/`), which uses an allowlist
`app/frontend/Dockerfile.dockerignore` (a plain `.dockerignore` in the repo root is
never read for that build, because the ignore-file must sit at the context root).

`updcli` is not baked into any image — it is provided at runtime as an optional
read-only mount (`./updcli:/opt/updcli:ro`) so it stays shareable across services.

---

## 🔌 Plugin Development

Create custom annotation tools, media processors, and export formats.

**Quick start:**
```bash
cd plugins_dev
npm install
npm run create-plugin my-plugin
```

📖 **[Complete Plugin Guide](https://docs.idah.ai/plugin/create-plugin/)**

---

## 🤝 Contributing

We welcome contributions from the community!

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Authors & Credits](AUTHORS.md)** - Contributors and maintainers
- **[Code of Conduct](https://docs.idah.ai)** - Community guidelines
- **[Development Guides](https://docs.idah.ai)** - Technical documentation

---

## 📄 License

This project is licensed under the **[Functional Source License (FSL)](LICENSE)**.

---

## 🌟 Technology Stack

- **Frontend:** SvelteKit, TypeScript, Tailwind CSS
- **Backend:** Ruby, [Verse Framework](https://github.com/verse-rb)
- **Databases:** PostgreSQL, Redis
- **Infrastructure:** Docker, Nginx, S3-compatible storage

[Learn more about the tech stack →](https://docs.idah.ai/getting-started/about/#technology-stack)

---

## 💡 Use Cases

IDAH can be applied to various domains:

- Computer Vision (object detection, segmentation, video tracking)
- Natural Language Processing (text classification, NER)
- Audio Processing (speech recognition, sound classification)
- Medical Imaging, Autonomous Vehicles, Manufacturing QA
- And more...

[Explore use cases →](https://docs.idah.ai/getting-started/use-cases/)

---

## 📞 Support & Community

- **Documentation:** [docs.idah.ai](https://docs.idah.ai)
- **Issues:** [GitHub Issues](https://github.com/idah-ai/idah/issues)

---

<div align="center">

**Made with ❤️ by the IDAH Team**

[Website](https://idah.ai) • [Documentation](https://docs.idah.ai) • [GitHub](https://github.com/idah-ai/idah)

</div>
