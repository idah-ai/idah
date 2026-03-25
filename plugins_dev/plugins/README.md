# Development Plugins

This directory contains plugins for **local development and testing only**. Plugins in this folder are automatically loaded when running IDAH in development mode, but are **NOT included in production builds**.

## Usage

### Create a New Development Plugin

```bash
# From the project root
cd plugins_dev
idah-plugin create my-dev-plugin ./plugins
```

This will create your plugin at `plugins_dev/plugins/my-dev-plugin/`.

### When Your Plugin is Ready for Production

Move your plugin from this directory to the main `plugins/` directory:

```bash
# From project root
mv plugins_dev/plugins/my-plugin plugins/my-plugin
```

Plugins in the main `plugins/` directory are loaded in all environments (development and production).

## Directory Purpose

- **Location**: `./plugins_dev/plugins/`
- **Environment**: Local development only
- **Loaded**: Automatically in development mode
- **Git**: Ignored (not committed to repository)
- **Use for**: Experimental features, testing, work-in-progress plugins

## See Also

- [Plugin Generator Documentation](../README.md)
- [Frontend Development Guide](../docs/FRONTEND_DEVELOPMENT.md)
- [Backend Development Guide](../docs/BACKEND_DEVELOPMENT.md)
