# IDAH Documentation Platform

The IDAH Documentation Platform is a comprehensive system for generating, viewing, and serving API documentation for the IDAH project. It consists of three main components: an OpenAPI specification generator, a Swagger UI viewer, and an Astro-based documentation frontend.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Architecture](#architecture)
- [Available Commands](#available-commands)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The documentation platform consists of three Docker services:

1. **doc-generator**: Ruby-based service that generates OpenAPI specifications from IDAH's backend services
2. **doc-swagger**: Swagger UI instance for interactive API documentation viewing
3. **doc-frontend**: Astro-based static site for comprehensive documentation

### Ports

- **4001**: Documentation frontend (Astro)
- **4002**: Swagger UI

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (v20.10 or higher)
- **Docker Compose** (v2.0 or higher)
- **Node.js** v24+ (for local development without Docker)
- **pnpm** (for local development without Docker)
- **Ruby** 3.4.2 (for local development without Docker)

## 📁 Project Structure

```text
doc/
├── bin/
│   └── generate_openapi          # Script to generate OpenAPI specs
├── public/                        # Astro frontend source code
│   ├── public/                    # Static assets
│   │   └── data/                  # OpenAPI JSON files (mounted)
│   ├── src/
│   │   ├── assets/                # Images and icons
│   │   ├── components/            # Astro and Svelte components
│   │   ├── layouts/               # Page layouts
│   │   ├── lib/                   # Utilities and UI components
│   │   ├── pages/                 # Route pages
│   │   └── styles/                # Global styles
│   ├── astro.config.mjs           # Astro configuration
│   ├── package.json               # Frontend dependencies
│   ├── svelte.config.js           # Svelte configuration
│   └── tsconfig.json              # TypeScript configuration
├── docker compose.yml             # Docker services configuration
├── Dockerfile.frontend            # Frontend container definition
├── Dockerfile.generator           # Generator container definition
└── README.md                      # This file
```

## 🚀 Getting Started

### Running with Docker (Recommended)

1. **Navigate to the doc directory:**
   ```bash
   cd doc
   ```

2. **Build and start all services:**
   ```bash
   docker compose up --build
   ```

   This will:
   - Build the doc-generator, install Ruby dependencies, and generate OpenAPI specs
   - Start Swagger UI at http://localhost:4002
   - Build and start the Astro frontend at http://localhost:4001

3. **Access the documentation:**
   - **Frontend Documentation**: http://localhost:4001
   - **Swagger API Explorer**: http://localhost:4002

### Stopping Services

```bash
docker compose down
```

To remove volumes as well:
```bash
docker compose down -v
```

## 💻 Development

### Working with the Frontend

#### Using Docker (Hot Reload Enabled)

The `doc-frontend` service has volume mounts configured for live development:

```bash
docker compose up doc-frontend
```

Changes to files in `./public` will automatically trigger hot reload.

#### Local Development (Without Docker)

1. **Navigate to the public directory:**
   ```bash
   cd doc/public
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm dev
   ```

   The site will be available at http://localhost:4001

4. **Other available commands:**
   ```bash
   pnpm build          # Build for production
   pnpm preview        # Preview production build
   pnpm format         # Format code with Prettier
   pnpm format:check   # Check code formatting
   ```

### Regenerating OpenAPI Specifications

When backend services change, you need to regenerate the OpenAPI specs:

1. **Using Docker:**
   ```bash
   docker compose up doc-generator
   ```

   This runs the `generate_openapi` script which:
   - Installs bundle dependencies for all services
   - Generates OpenAPI JSON files to `./openapi/definitions/`
   - Creates `./openapi/swagger.json` with aggregated specs

2. **Manual regeneration:**
   ```bash
   docker compose exec doc-generator ./bin/generate_openapi
   ```

### Working with the Generator

The generator service processes all IDAH backend services:

- **Services scanned**: audit, dataset, iam, media, notification, setting, sync
- **Output format**: OpenAPI 3.0 JSON
- **Output location**: `./openapi/definitions/`

#### Accessing the generator container:

```bash
docker compose exec doc-generator bash
```

## 🏗️ Architecture

### Service Dependencies

```
doc-frontend  ──┐
                ├──> doc-generator (generates OpenAPI specs)
doc-swagger   ──┘
```

Both `doc-frontend` and `doc-swagger` depend on `doc-generator` to produce the OpenAPI specifications.

### Data Flow

1. **Generation Phase** (doc-generator):
   - Scans all IDAH services (`app/*`)
   - Extracts API routes and generates OpenAPI specs
   - Outputs JSON files to `./openapi/definitions/`
   - Creates aggregated `swagger.json`

2. **Presentation Phase**:
   - **Swagger UI** serves interactive API documentation
   - **Astro Frontend** builds static documentation site with custom components

### Technology Stack

#### Frontend (Astro)
- **Framework**: Astro 5.16+
- **UI Library**: Svelte 5.47+
- **Styling**: Tailwind CSS 4.1+
- **Components**: bits-ui, lucide icons
- **Code Highlighting**: Prism.js
- **Build Tool**: Vite

#### Generator (Ruby)
- **Ruby Version**: 3.4.2
- **Dependencies**: FFmpeg, ImageMagick, PostgreSQL client libs
- **Build Tools**: bundler, rake

#### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **API Docs**: Swagger UI

### Volume Mounts

The following volumes are used for development:

- `generator_bundle`: Ruby gems for the generator
- `frontend_node_modules`: Node.js dependencies for frontend
- `./openapi`: Generated OpenAPI specifications (shared across services)
- `./public`: Frontend source code (mounted to doc-frontend)

## 📝 Available Commands

### Docker Compose Commands

```bash
# Start all services
docker compose up

# Start services in detached mode
docker compose up -d

# Rebuild and start services
docker compose up --build

# Start specific service
docker compose up doc-frontend

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f doc-frontend

# Execute command in running container
docker compose exec doc-generator bash
docker compose exec doc-frontend sh
```

### Frontend Commands (in ./public/)

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start development server (port 4001)
pnpm build                # Build for production
pnpm preview              # Preview production build
pnpm format               # Format code with Prettier
pnpm format:check         # Check code formatting
```

### Generator Scripts

```bash
# Generate OpenAPI specs (run inside doc-generator container)
./bin/generate_openapi

# Install dependencies for all services (run inside doc-generator container)
./bin/all_services bundle install
```

## 🔧 Troubleshooting

### Frontend Issues

**Issue**: Frontend not loading or showing errors
```bash
# Rebuild node_modules volume
docker compose down -v
docker compose up --build doc-frontend
```

**Issue**: Changes not reflecting (hot reload not working)
```bash
# Ensure volumes are properly mounted
docker compose down
docker compose up doc-frontend
```

### Generator Issues

**Issue**: OpenAPI specs not generating
```bash
# Check generator logs
docker compose logs doc-generator

# Manually run generation
docker compose exec doc-generator ./bin/generate_openapi
```

**Issue**: Bundle install fails
```bash
# Clear bundle volume and rebuild
docker compose down -v
docker compose up --build doc-generator
```

### Swagger UI Issues

**Issue**: Swagger UI not showing specs
```bash
# Verify swagger.json was created
cat ./openapi/swagger.json

# Regenerate specs
docker compose up doc-generator

# Restart Swagger UI
docker compose restart doc-swagger
```

### Port Conflicts

**Issue**: Ports 4001 or 4002 already in use
```bash
# Find and kill process using the port
lsof -ti:4001 | xargs kill -9
lsof -ti:4002 | xargs kill -9

# Or modify ports in docker compose.yml
```

### Permission Issues

**Issue**: Permission denied when accessing volumes
```bash
# Fix permissions
sudo chown -R $USER:$USER ./openapi
sudo chown -R $USER:$USER ./public
```

### General Debugging

```bash
# Check service status
docker compose ps

# View all logs
docker compose logs

# Inspect a container
docker compose exec doc-frontend sh
docker compose exec doc-generator bash

# Rebuild everything from scratch
docker compose down -v
docker compose build --no-cache
docker compose up
```

## 📚 Additional Resources

- [Astro Documentation](https://docs.astro.build/)
- [Svelte Documentation](https://svelte.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Specification](https://swagger.io/specification/)

## 🤝 Contributing

When working on the documentation platform:

1. Keep the frontend code in `./public/src/`
2. Follow the existing component structure
3. Use Prettier for code formatting (`pnpm format`)
4. Test changes with both Docker and local development
5. Regenerate OpenAPI specs when backend changes are made
6. Update this README when making architectural changes
