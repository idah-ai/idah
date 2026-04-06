# {{pluginDisplayName}} - Backend

This directory contains backend services for the **{{pluginDisplayName}}** plugin.

**Version:** {{pluginVersion}}

## Backend Services

This plugin includes the following backend services:

- **Media Service** - Media file processing (if `media/` directory exists)
- **Sync Service** - Data export and synchronization (if `sync/` directory exists)

## Quick Start

```bash
# Install dependencies
bundle install

# Run tests
bundle exec rspec

# Run tests with coverage
bundle exec rspec --format documentation
```

## Structure

```
backends/
├── spec_helper.rb          # Shared RSpec configuration
├── media/                  # Media processing service (if enabled)
│   ├── {{pluginRubyFilename}}.rb
│   ├── processor.rb
│   └── options.rb
└── sync/                   # Export/sync service (if enabled)
    ├── {{pluginRubyFilename}}.rb
    └── export.rb
```

## Documentation

For detailed documentation on backend development, see:

- **[Backend Development Guide](https://github.com/ingedata-ph/idah/tree/main/plugins_dev/docs/BACKEND_DEVELOPMENT.md)** - Complete guide with examples and best practices
- **[idah-video Plugin](https://github.com/ingedata-ph/idah/tree/main/plugins/idah-video/backends/media)** - Real-world example of a media backend implementation
- **[UPD Exporter](https://github.com/ingedata-ph/idah/tree/main/app/sync/app/service/exports/upd/)** - Real-world example of a sync backend exporter

## Running Tests

```bash
# Run all tests
bundle exec rspec

# Run specific service tests
bundle exec rspec media/
bundle exec rspec sync/

# Run with coverage
bundle exec rspec
```

Coverage reports are generated in `coverage/index.html`.

## Need Help?

1. Check the [Backend Development Guide](https://github.com/ingedata-ph/idah/tree/main/plugins_dev/docs/BACKEND_DEVELOPMENT.md)
2. Review the [idah-video plugin](https://github.com/ingedata-ph/idah/tree/main/plugins/idah-video/backends/) for a complete example
3. Contact the IDAH development team

Happy coding! 🚀
