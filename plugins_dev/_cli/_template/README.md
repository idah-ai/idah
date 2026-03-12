# {{pluginDisplayName}}

{{pluginDescription}}

**Version:** {{pluginVersion}}

## Overview

This IDAH plugin provides functionality for {{pluginDescription}}.

## Project Structure

```
{{pluginName}}/
├── README.md              # This file
├── manifest.json          # Plugin metadata and configuration
├── frontend/              # Frontend SvelteKit application
│   └── README.md         # Frontend quick start guide
├── backends/              # Backend Ruby services (if enabled)
│   └── README.md         # Backend quick start guide
├── Gemfile                # Ruby dependencies
└── Rakefile               # Build tasks
```

## Quick Start

### Frontend Development

```bash
cd frontend
pnpm install
pnpm dev
```

See [frontend/README.md](frontend/README.md) for details.

### Backend Development

```bash
bundle install
bundle exec rspec
```

See [backends/README.md](backends/README.md) for details.

## Documentation

- **[Frontend Development Guide](../development/docs/FRONTEND_DEVELOPMENT.md)** - Complete frontend guide with Activity Context API
- **[Backend Development Guide](../development/docs/BACKEND_DEVELOPMENT.md)** - Complete backend development guide
- **[Plugin Generator README](../development/README.md)** - CLI commands and usage

## Installation in IDAH

1. Ensure the plugin is in the `plugins/` directory
2. Build the frontend: `cd frontend && pnpm build`
3. Restart IDAH
4. The plugin will be automatically loaded

## Testing

### Frontend Tests
```bash
cd frontend
pnpm test
```

### Backend Tests
```bash
cd backends
bundle exec rspec
```

## Contributing

1. Make changes to your plugin
2. Run tests to ensure everything works
3. Build the frontend for production
4. Test in the full IDAH platform

## Need Help?

1. Check the documentation links above
2. Review other plugin examples: `plugins/idah-video/`
3. Contact the IDAH development team

---

Generated with [IDAH Plugin Generator](../development/)
