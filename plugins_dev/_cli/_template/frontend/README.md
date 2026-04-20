# {{pluginDisplayName}} - Frontend

This is the frontend component of the **{{pluginDisplayName}}** plugin for IDAH.

**Version:** {{pluginVersion}}
**Description:** {{pluginDescription}}

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Technology Stack

- **Framework:** SvelteKit with Svelte 5
- **Language:** TypeScript
- **Build Tool:** Vite
- **Package Manager:** pnpm

## Development

### Start Development Server

```bash
pnpm dev
```

Your plugin will be available at http://localhost:5173

### Build for Production

```bash
pnpm build
```

Output files will be in the `build/` directory.

## Main Files

- `src/lib/plugin/plugin.svelte` - Your main plugin component
- `src/lib/context.ts` - Activity Context interface
- `src/routes/test_context.ts` - Mock context for local testing

## Documentation

For detailed documentation on plugin development, see:

- **[Frontend Development Guide](https://github.com/ingedata-ph/idah/tree/main/plugins_dev/docs/FRONTEND_DEVELOPMENT.md)** - Complete guide with Activity Context API, best practices, and examples
- **[Main Generator README](https://github.com/ingedata-ph/idah/tree/main/plugins_dev/README.md)** - CLI commands and plugin generator usage

## Need Help?

1. Check the [Frontend Development Guide](https://github.com/ingedata-ph/idah/tree/main/plugins_dev/docs/FRONTEND_DEVELOPMENT.md)
2. Review other plugin examples in the `plugins/` directory
3. Contact the IDAH development team

Happy coding! 🚀
