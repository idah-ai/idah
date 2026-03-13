# Frontend Development Guide

This guide covers frontend development for IDAH plugins using SvelteKit and Svelte 5.

## Overview

IDAH plugin frontends are built with SvelteKit and Svelte 5, providing a modern, reactive UI framework. Plugins are compiled to UMD bundles and loaded dynamically by the IDAH platform. The Activity Context API provides access to datasets, annotations, tools, and workflow management.

**Technology Stack:**
- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript
- **Build Tool**: Vite
- **Package Manager**: pnpm (recommended) or npm

## File Structure

```
frontend/
├── README.md                 # Frontend quick start guide
├── package.json              # npm dependencies and scripts
├── pnpm-lock.yaml            # Locked dependencies
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── svelte.config.js          # SvelteKit configuration
├── vite.config.ts            # Vite build configuration
├── tsconfig.json             # TypeScript configuration
├── .gitignore                # Git ignore rules
├── .npmrc                    # npm configuration
├── src/
│   ├── app.html              # HTML template
│   ├── app.d.ts              # TypeScript declarations
│   ├── lib/
│   │   ├── index.ts          # Library exports
│   │   ├── context.ts        # Activity Context interface
│   │   ├── assets/
│   │   │   └── favicon.svg   # Favicon
│   │   └── plugin/
│   │       ├── plugin.svelte # Main plugin component (your code here!)
│   │       └── plugin.css    # Plugin styles
│   └── routes/
│       ├── +layout.svelte    # Root layout
│       ├── +page.svelte      # Main page (loads plugin)
│       └── test_context.ts   # Mock Activity Context for development
└── static/
    └── robots.txt            # Robots.txt for SEO
```

**Key Files:**
- `src/lib/plugin/plugin.svelte` - **Your main plugin component** - develop your UI here
- `src/lib/context.ts` - Activity Context TypeScript interface
- `src/routes/test_context.ts` - Mock context for local development
- `vite.config.ts` - Build configuration (UMD output for IDAH)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Development Workflow

### 1. Develop Your Plugin

Edit `src/lib/plugin/plugin.svelte` - this is your main plugin component:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import type { PluginContext } from '$lib/context'

  export let context: PluginContext

  onMount(() => {
    console.log('Plugin mounted!', context)
  })
</script>

<div class="plugin-container">
  <h1>My Plugin</h1>
  <p>Your plugin description here</p>

  <!-- Your plugin UI here -->
</div>

<style>
  .plugin-container {
    padding: 1rem;
  }
</style>
```

### 2. Use the Activity Context

## Activity Context API Reference

The `IActivityContext` interface provides these core APIs:

### Basic Properties
```typescript
context.id              // Current entry ID
context.type            // Activity type
context.workflowStep    // 'start' | 'annotate' | 'review' | 'done' | 'export'
context.status          // Entry status
context.config          // Dataset configuration
context.mediaUrl        // Root media URL
context.user            // Current user info
context.userRole        // User role
```

### Annotations Driver
```typescript
// Create annotation
await context.annotations.create(
  id,           // unique ID (use uuidv7())
  dimensions,   // shape/dimension data
  annotation,   // annotation values
  metadata      // optional metadata
)

// Update annotation
await context.annotations.update({
  id,
  dimensions,
  annotation,
  metadata
})

// Delete annotation
await context.annotations.delete(id)

// List annotations
const results = await context.annotations.list(
  { entry_id: context.id },
  { page: 1, itemsPerPage: 100 }
)

// Flush changes
context.annotations.flush()
```

### Commands (Undo/Redo System)
```typescript
// Register a command
context.commands.on('commandName', (props) => {
  return {
    name: 'Human-readable name',
    async apply() {
      // Do the action
    },
    async undo() {
      // Undo the action
    },
    isCombinable: () => false,
    combine: (cmd) => cmd
  }
})

// Run a command
context.commands.run('commandName', { /* props */ })

// Undo/Redo
context.commands.undo()
context.commands.redo()
```

### Tools (Header Bar Tools)
```typescript
// Set available tools
context.tools.setTools([
  {
    type: 'visual',
    label: 'Visual',
    iconName: 'mouse-pointer-2',
    handleClick: () => context.commands.run('tools.visual')
  },
  {
    type: 'bounding-box',
    label: 'Bounding Box',
    iconName: 'vector-square',
    disabled: !['annotate', 'review'].includes(context.workflowStep),
    handleClick: () => context.commands.run('tools.boundingBox')
  }
])

// Set active tool
context.tools.setTool('visual')

// Listen to tool changes
context.tools.onToolChange((tool) => {
  console.log('Tool changed:', tool)
})
```

### Notes
```typescript
// Show note popup
context.notes.showNewNoteFeedPopup({
  anchor_type: 'annotation',  // 'entry' | 'annotation'
  position: { x: 100, y: 200, sidebar_width: 256 },
  annotation_id: 'ann-123'
})

// Navigate to note
context.notes.gotoFeed(noteFeedId, noteCommentId)

// Listen for note selection
context.notes.onNoteSelected((noteFeedId, noteCommentId) => {
  // Handle note selection
})
```

### Workflow Navigation
```typescript
// Submit to next workflow step
await context.submit({ approved: true })

// Go back to previous step
context.back()

// Mark as errored
await context.error('Error message')
```

### 3. Style Your Plugin

Add styles in `src/lib/plugin/plugin.css` or use scoped styles within your Svelte components:

```css
/* Global plugin styles */
.plugin-container {
  font-family: system-ui, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
}

/* Component-specific styles use <style> in .svelte files */
```

## Building for Production

### Build the Plugin

```bash
pnpm build
```

This generates:
- `build/plugin.umd.js` - Main plugin bundle
- `build/plugin.css` - Plugin styles
- `build/entryDetailsBuild.js` - Entry details component (if applicable)
- `build/entryDetailsBuild.css` - Entry details styles

### Build Output

The build process creates UMD (Universal Module Definition) bundles that can be loaded by the IDAH platform. These files are referenced in your plugin's `manifest.json`:

```json
{
  "entryPoints": {
    "entryPlugin": {
      "script": "/frontend/build/plugin.umd.js",
      "style": "/frontend/build/plugin.css"
    }
  }
}
```

## TypeScript

### Type Checking

```bash
# Check types
pnpm check

# Check types in watch mode
pnpm check:watch
```

### Adding Types

Define your types in `src/lib/types.ts` or alongside your components:

```typescript
export interface MyPluginData {
  id: string
  title: string
  metadata: Record<string, any>
}
```

## Best Practices

###  Component Organization

```
src/lib/
├── plugin/
│   ├── plugin.svelte          # Main plugin component
│   ├── components/            # Reusable components
│   │   ├── Header.svelte
│   │   ├── DataTable.svelte
│   │   └── Chart.svelte
│   ├── stores/                # Svelte stores for state
│   │   └── pluginState.ts
│   ├── utils/                 # Utility functions
│   │   └── formatters.ts
│   └── types/                 # TypeScript types
│       └── index.ts
```

### 2. State Management

Use Svelte stores for shared state:

```typescript
// src/lib/plugin/stores/pluginState.ts
import { writable } from 'svelte/store'

export const selectedItems = writable<string[]>([])
export const isLoading = writable(false)
```

### 3. Error Handling

Always handle errors gracefully:

```svelte
<script lang="ts">
  let error = $state<string | null>(null)

  async function loadData() {
    try {
      // ... load data
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to load data:', err)
    }
  }
</script>

{#if error}
  <div class="error-message">{error}</div>
{/if}
```

### 4. Performance

- Use `$effect` for side effects instead of `onMount` when appropriate
- Lazy load heavy components
- Optimize images and assets
- Use virtual scrolling for large lists

### 5. Accessibility

- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers

## Testing

### Manual Testing

1. Start the dev server: `pnpm dev`
2. Open http://localhost:5173
3. Modify `test_context.ts` to test different scenarios
4. Test responsive design at different screen sizes

### Integration Testing

Test your plugin in the full IDAH platform:

1. Build the plugin: `pnpm build`
2. Copy the plugin to IDAH's plugins directory
3. Restart IDAH
4. Test with real data

## Troubleshooting

### Port Already in Use

If port 5173 is busy, Vite will try the next available port. You can also specify a port:

```bash
pnpm dev -- --port 3000
```

### Build Errors

Clear the build cache and reinstall:

```bash
rm -rf node_modules build .svelte-kit
pnpm install
pnpm build
```

### Type Errors

Regenerate SvelteKit types:

```bash
pnpm run prepare
```

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Tutorial](https://svelte-5-preview.vercel.app/tutorial)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

## Support

For plugin-specific questions:
1. Check the IDAH platform documentation
2. Review other plugin examples in the [plugins/](../../plugins) directory
3. Contact the IDAH development team

Happy coding! 🚀
