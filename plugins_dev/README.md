# IDAH Plugin Development

This directory contains the IDAH Plugin Generator CLI tool and is the recommended location for developing and testing plugins before moving them to production.

## 📚 Documentation

For comprehensive guides on plugin development, visit the official documentation at **[docs.idah.ai](https://docs.idah.ai)**:

### Getting Started
- **[Plugin Overview](https://docs.idah.ai/plugin/)** - Introduction to IDAH's plugin system, plugin types, and architecture
- **[Create a Plugin](https://docs.idah.ai/plugin/create-plugin/)** - Step-by-step guide to scaffolding new plugins using the CLI

### Development Guides
- **[Frontend Guide](https://docs.idah.ai/plugin/frontend-guide/)** - Build plugin UIs with SvelteKit and Svelte 5
- **[Backend Guide](https://docs.idah.ai/plugin/backend-guide/)** - Develop backend services in Ruby

### Advanced Topics
- **[Import & Process Media](https://docs.idah.ai/plugin/import-media/)** - Add media processing capabilities (images, videos, audio)
- **[Export Datasets](https://docs.idah.ai/plugin/export-datasets/)** - Create custom data exporters and sync services

## 🚀 Quick Start

### Using the Plugin Generator (npx - recommended)

The easiest way to create a new plugin:

```bash
# Create a new plugin in the plugins_dev/plugins directory
npx idah-plugin create my-plugin ./plugins

# Or create in the production plugins directory
npx idah-plugin create my-plugin ../plugins
```

### Add Backend to Existing Plugin

```bash
# Add media or sync backend to an existing plugin
npx idah-plugin backend add my-plugin ./plugins
```

## 📁 Directory Structure

```
plugins_dev/
├── README.md          # This file
├── package.json       # CLI tool dependencies
├── _cli/              # CLI source code
└── plugins/           # Development plugins directory
    └── your-plugin/   # Your plugins go here
```

## 🔧 Plugin Development Workflow

### 1. **Create Your Plugin**
```bash
npx idah-plugin create my-plugin ./plugins
```

### 2. **Develop Frontend**
```bash
cd plugins/my-plugin/frontend
pnpm install
pnpm dev
```

Visit http://localhost:5173 to see your plugin in development mode.

### 3. **Add Backend Services (Optional)**
```bash
# From plugins_dev directory
npx idah-plugin backend add my-plugin ./plugins
```

Choose from:
- **Media Service** - Process media files during import
- **Sync Service** - Export and synchronize data

### 4. **Build for Production**
```bash
cd plugins/my-plugin/frontend
pnpm build
```

### 5. **Test in IDAH Platform**
- Place your plugin in [/plugins_dev/plugins](.) for development testing
- Move to [/plugins](../plugins) when ready for production

## 📂 Plugin Directories

IDAH supports two plugin directories:

#### Development Plugins [/plugins_dev/plugins](.)
- **Purpose:** Development and testing
- **Environment:** Local development only
- **Loading:** Automatically loaded in development mode
- **Not included:** These plugins are **not** loaded in production
- **Use for:** Experimental plugins, work-in-progress features, testing

#### Production Plugins [/plugins](../plugins)
- **Purpose:** Production-ready plugins
- **Environment:** Both development and production
- **Loading:** Always loaded in all environments
- **Use for:** Stable, production-ready plugins

> **Recommendation:** Start developing in [/plugins_dev/plugins](.), and move to [/plugins](../plugins) when ready for production.

## 🛠️ CLI Commands

### Create a Plugin
```bash
npx idah-plugin create <plugin_name> [output_path]
```

**Examples:**
```bash
# Create in current directory
npx idah-plugin create my-plugin

# Create in plugins_dev/plugins directory
npx idah-plugin create my-plugin ./plugins

# Create in production plugins directory
npx idah-plugin create my-plugin ../plugins
```

### Add Backend Services
```bash
npx idah-plugin backend add <plugin_name> [base_path]
```

**Examples:**
```bash
# Add backend to plugin in plugins directory
npx idah-plugin backend add my-plugin ./plugins
```

### Get Help
```bash
npx idah-plugin --help
npx idah-plugin create --help
npx idah-plugin backend --help
```

## 🏗️ Plugin Structure

A typical IDAH plugin structure:

```
my-plugin/
├── manifest.json          # Plugin metadata
├── README.md              # Plugin documentation
├── Gemfile                # Ruby dependencies (backends)
├── Rakefile               # Build tasks
├── backends/              # Backend services (optional)
│   ├── media/            # Media processing
│   └── sync/             # Data export
└── frontend/              # SvelteKit UI
    ├── package.json
    ├── src/
    │   ├── lib/
    │   │   └── plugin/
    │   │       └── plugin.svelte  # Main plugin component
    │   └── routes/
    └── build/            # Production build output
```

## 🧪 Testing

### Frontend Testing
```bash
cd plugins/my-plugin/frontend
pnpm dev          # Development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm check        # Type checking
```

### Backend Testing
```bash
cd plugins/my-plugin
bundle install
bundle exec rspec backends/
```

## 📖 Example Plugins

### Built-in Plugin
- **idah-video** - Located at [/plugins/idah-video](../plugins/idah-video)
  - Full-stack video annotation plugin
  - Media processing backend
  - Timeline-based frontend editor

## 🆘 Getting Help

- **Documentation:** [docs.idah.ai/plugin](https://docs.idah.ai/plugin/)
- **Issues:** Report bugs or request features via GitHub issues
- **Community:** Join the IDAH community discussions

## ⚡ Local CLI Development

If you're developing the CLI tool itself:

```bash
# Install dependencies
cd plugins_dev
npm install

# Link for local development
npm link

# Use the CLI
idah-plugin create test-plugin

# Unlink when done
npm unlink -g idah-plugin
```

## 📝 Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Tutorial](https://svelte-5-preview.vercel.app/tutorial)
- [Ruby Documentation](https://ruby-doc.org/)
- [Verse Framework](https://github.com/verse-rb)

---

**Ready to build your first plugin?** Start with the [Create a Plugin guide](https://docs.idah.ai/plugin/create-plugin/) on docs.idah.ai!
