# IDAH Plugin Generator

A CLI tool to generate and manage plugins for the IDAH platform. This tool helps you quickly scaffold new plugins with frontend and optional backend components.

## Installation

### Quick start using npx

```bash
# Create a plugin
npx idah-plugin create audio-plugin ./plugins

# Add backend to existing plugin in ./plugins directory
npx idah-plugin backend add audio-plugin ./plugins

# Get help
npx idah-plugin --help
```

### Local Development with npm link

For local development and testing, use npm link:

```bash
cd plugins_dev
npm install
npm link
```

This creates a symlink in your global node_modules. You can now use the `idah-plugin` command from anywhere, and changes to the source code will be immediately available.

To unlink when you're done:
```bash
npm unlink -g idah-plugin
```

### Global Installation

Install the CLI globally:

```bash
# From npm (after publishing)
npm install -g idah-plugin

# Or from local directory
cd plugins_dev
npm install -g .
```

After installation, you can use the `idah-plugin` command from any directory.

### Direct Usage (Without Installation)

If you prefer not to install at all:

```bash
cd plugins_dev
npm install
node _cli/bin/cli.js <command>
```

## Plugin Paths

IDAH supports two plugin directories for different environments:

### Development Plugins
**Path:** [`./plugins_dev/plugins`](./plugins)

- **Purpose:** Development and testing
- **Environment:** Local development only
- **Loading:** Automatically loaded when running IDAH in development mode
- **Not included:** These plugins are **not** loaded in production
- **Use for:** Experimental plugins, work-in-progress features, testing

### Production Plugins
**Path:** [`../plugins`](../plugins)

- **Purpose:** Production-ready plugins
- **Environment:** Both development and production
- **Loading:** Always loaded in all environments
- **Use for:** Stable, production-ready plugins

**Recommendation:** Start developing in `./plugins_dev/plugins`, and move to `../plugins` when ready for production.

## Commands

### Create a New Plugin

Create a new plugin from scratch:

```bash
idah-plugin create <plugin_name> [output_path]
```

**Examples:**
```bash
# Create in current directory
idah-plugin create my-awesome-plugin
# Creates: ./my-awesome-plugin

# Create in specific directory
idah-plugin create audio-plugin ./plugins
# Creates: ./plugins/audio-plugin

# Create with absolute path
idah-plugin create video-plugin /path/to/plugins
# Creates: /path/to/plugins/video-plugin
```

This command will:
1. Prompt you for a **display name** (user-friendly name shown in the UI)
2. Prompt you for a **description** (brief description of your plugin)
3. Prompt you for a **version** (semantic version, default: 0.0.1)
4. Ask which **backend services** you want to include (media, sync, or none)
5. Generate the complete plugin structure in the specified location

**Parameters:**
- `<plugin_name>` - (Required) Name of the plugin in kebab-case
- `[output_path]` - (Optional) Directory where the plugin should be created (default: current directory)

**Note:** You can create frontend-only plugins by not selecting any backend services. This is useful for plugins that only need a UI component.

### Add Backend Services to Existing Plugin

Add one or more backend services to an existing plugin:

```bash
idah-plugin backend add <plugin_name> [base_path]
```

**Examples:**
```bash
# Add backend to plugin in current directory
idah-plugin backend add my-awesome-plugin
# Looks for: ./my-awesome-plugin

# Add backend to plugin in specific directory
idah-plugin backend add audio-plugin ./plugins
# Looks for: ./plugins/audio-plugin
```

**Parameters:**
- `<plugin_name>` - (Required) Name of the plugin
- `[base_path]` - (Optional) Directory containing the plugin (default: current directory)

This command will:
1. Check if the plugin exists at the specified location
2. Prompt you to select which backend service(s) to add
3. Copy the backend templates and configure them for your plugin
4. Skip any backend services that already exist

**Output location:** The new backend(s) will be added to `<plugin_name>/backends/<backend_service>/`

For example:
- Adding "media" service → `<plugin_name>/backends/media/`
- Adding "sync" service → `<plugin_name>/backends/sync/`

### Get Help

Display help information:

```bash
idah-plugin --help
# or
idah-plugin -h
```

## Plugin Structure

When you create a plugin, the following high-level structure is generated:

```
<plugin_name>/
├── README.md               # Plugin overview and quick start
├── manifest.json           # Plugin metadata and configuration
├── Gemfile                 # Ruby dependencies (for backends)
├── Rakefile                # Build and test tasks
├── .gitignore
├── .rspec
├── backends/               # Backend services (optional)
│   ├── README.md          # Backend quick start guide
│   ├── media/             # Media processing service (if selected)
│   └── sync/              # Data export/sync service (if selected)
└── frontend/               # Frontend SvelteKit application
    ├── README.md          # Frontend quick start guide
    ├── package.json
    └── src/               # Source code
```

For detailed structure information:
- **[Frontend Structure →](docs/FRONTEND_DEVELOPMENT.md#file-structure)** - Complete frontend directory layout
- **[Backend Structure →](docs/BACKEND_DEVELOPMENT.md#file-structure)** - Complete backend directory layout for backend services

## Workflow Examples

**Note:** It's recommended to create plugins in the `./plugins` directory, as this path is automatically loaded by the IDAH platform during development.

### Example 1: Create a Frontend-Only Plugin

```bash
# Create a new plugin in the plugins directory (recommended)
idah-plugin create ui-widget ./plugins

# When prompted:
# - Display name: UI Widget
# - Description: A simple UI widget plugin
# - Version: 0.0.1 (or press Enter for default)
# - Backend services: (press Enter without selecting any)

# Your plugin is ready at ./plugins/ui-widget/
cd plugins/ui-widget/frontend
pnpm install
pnpm dev
```

### Example 2: Create a Full-Stack Plugin

```bash
# Create a plugin with both backend services in plugins directory
idah-plugin create video-converter ./plugins

# When prompted:
# - Display name: Video Converter
# - Description: Convert videos to different formats
# - Version: 1.0.0
# - Backend services: Select both "Media Service" and "Sync Service"

# Your plugin is ready with backend and frontend
cd plugins/video-converter
```

### Example 3: Create Multiple Plugins

```bash
# Create several plugins in the standard plugins directory
idah-plugin create image-gallery ./plugins
idah-plugin create data-exporter ./plugins
idah-plugin create custom-dashboard ./plugins

# All plugins will be in ./plugins/ and automatically loaded by IDAH
```

### Example 4: Add Backend to Existing Plugin

```bash
# First create a frontend-only plugin
idah-plugin create image-processor ./plugins

# Later, add backend services (specify base path where plugin is located)
idah-plugin backend add image-processor ./plugins

# When prompted, select "Media Service"
# The media backend is now added to your existing plugin at ./plugins/image-processor
```

## Development

After creating your plugin:

### Frontend Development

```bash
cd plugins/<plugin_name>/frontend
pnpm install
pnpm dev
```

### Backend Development

```bash
cd plugins/<plugin_name>
bundle install
bundle exec rspec  # Run tests
```

## Plugin Naming Conventions

- **Plugin name** (CLI argument): Use kebab-case (e.g., `my-awesome-plugin`)
- **Display name** (prompts): Use human-readable format (e.g., `My Awesome Plugin`)
- **Module name** (generated): PascalCase (e.g., `MyAwesomePlugin`)
- **Ruby filename** (generated): snake_case (e.g., `my_awesome_plugin.rb`)

## Troubleshooting

### Plugin already exists
If you see an error that the plugin already exists, either:
- Choose a different name
- Delete the existing plugin directory first
- Use `backend add` to add services to the existing plugin

### Backend service already exists
When using `backend add`, if a service already exists, it will be skipped automatically. You'll see an informational message.

### Permission errors
If you get permission errors during global installation:
```bash
sudo npm install -g .
# or use a Node version manager like nvm
```

## Testing

The generator includes a comprehensive test suite using Vitest.

### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (helpful during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The test suite covers:
- **Utility functions** (`util.test.js`): String transformation functions, ignore filters
- **Scaffold functions** (`scaffold.test.js`): Plugin creation, backend addition, error handling

## Documentation

This generator includes comprehensive documentation:

### For Plugin Developers

- **[Frontend Development Guide](docs/FRONTEND_DEVELOPMENT.md)** - Complete guide for building plugin UIs with SvelteKit, including Activity Context API reference
- **[Backend Development Guide](docs/BACKEND_DEVELOPMENT.md)** - Complete guide for building backend services in Ruby

### Generated Plugin Documentation

Each generated plugin includes its own README files:

- **Plugin Root README** - Overview and quick start for the specific plugin
- **frontend/README.md** - Frontend quick start with links to detailed docs
- **backends/README.md** - Backend quick start with links to detailed docs

All documentation is automatically customized with your plugin's name, description, and version.

## Publishing to npm

### Before Publishing

1. **Update version** in `package.json`:
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

3. **Test the package locally** with npm link:
   ```bash
   npm link
   idah-plugin create test-plugin
   npm unlink -g idah-plugin
   ```

### Publishing

```bash
# Login to npm (first time only)
npm login

# Publish the package
npm publish

# For first-time publish or scoped packages
npm publish --access public
```

### After Publishing

Test with npx:
```bash
npx idah-plugin create test-plugin ./plugins
```

### Version Management

The package follows [Semantic Versioning](https://semver.org/):
- **Patch** (1.0.x) - Bug fixes, documentation updates
- **Minor** (1.x.0) - New features, backwards compatible
- **Major** (x.0.0) - Breaking changes

## Template Customization

The plugin templates are located in `plugins_dev/_cli/_template/`. You can customize these templates to match your team's conventions and requirements.

## Support

For issues or questions:
1. Check this README first
2. Review the existing plugins in the `plugins/` directory for examples
3. Contact the IDAH development team

## License

See the main IDAH project LICENSE file.
