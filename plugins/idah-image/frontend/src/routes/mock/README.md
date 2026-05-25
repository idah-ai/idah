# Mock Development Setup

This directory provides a standalone mock environment for developing the **idah-image** plugin without needing the full IDAH backend stack.

## Quick Start

1. **Place your image file** in `static/sample.m3u8` (or any path the mock context points to).

   You can also edit `src/mock/context.ts` and change the `mediaUrl` getter to point to any image source (e.g., a remote HLS stream).

2. **Start the dev server**:

   ```bash
   cd plugins/idah-image/frontend
   pnpm dev
   ```

3. **Open your browser** at `http://localhost:5173` — the plugin will mount immediately with sample data.

## How It Works

The mock is a self-contained `IActivityContext` implementation that simulates the host application. It provides:

| Feature             | Implementation                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| Entry metadata      | Hardcoded entry ID, status, workflow step                                 |
| Annotation storage  | In-memory array with 4 pre-seeded annotations (bounding boxes + polygons) |
| Label configuration | 6 categories for bounding-box, 3 for polygon, with custom properties      |
| Media               | Image URL from `mediaUrl` getter; metadata returns 250 frames at 25 fps   |
| User                | Hardcoded annotator user                                                  |
| Notes               | No-op stubs with console logging                                          |
| Commands            | Wired to local `CommandManager` (undo/redo stack)                         |
| Shortcuts           | Fully registered via `ShortcutManager`                                    |
| Icons               | Inline SVG strings                                                        |

## Customizing the Mock

### Change the Image Source

In `src/mock/context.ts`, update the `mediaUrl` getter:

```ts
get mediaUrl() {
  return "http://your-server/path/to/image.m3u8";
  // or use a local file in static/:
  // return "/medias/my-image.m3u8";
}
```

Also update the `mediaInfo()` method to match your image's actual duration and fps:

```ts
async mediaInfo(key?: string): Promise<IMedia> {
  return {
    resource: key || "mock-entry-001",
    key: key || "master",
    mime_type: "video/mp4",
    filename: "sample.mp4",
    meta: {
      duration: 10,     // seconds
      fps: 25,          // frames per second
      width: 1920,
      height: 1080,
    },
    // ...
  };
}
```

### Add More Sample Annotations

Edit the `SAMPLE_ANNOTATIONS` array in `src/mock/context.ts`. Each annotation follows the `IAnnotation` interface:

```ts
{
  id: "ann-005",
  dimensions: {
    type: "idah-image:bounding-box",
    start: 100,
    end: 300,
    frames: [
      { frame: 100, points: [[0.1, 0.1], [0.3, 0.3]], angle: 0 },
      { frame: 200, points: [[0.12, 0.12], [0.32, 0.32]], angle: 5 },
    ],
  },
  annotation: {
    category: "person",
    attributes: {},
  },
  created_by_id: "1",
  created_at: new Date(),
  updated_at: new Date(),
  metadata: { group_id: "group-005" },
}
```

### Change Label Categories

Edit the `config` getter. The config is keyed by shape type (`"idah-image:bounding-box"`, `"idah-image:polygon"`):

```ts
"idah-image:bounding-box": {
  values: [
    { id: "vehicles/car", color: "#F6402B", label: "Car", text_color: "#FFFFFF" },
    // ...
  ],
  properties: [
    {
      id: "wheels",
      type: "integer",
      label: "Number of wheels",
      format: { minimum: 0, maximum: 24, step: 1 },
      required: true,
      visibility: true,
      description: "",
    },
  ],
},
```

## Notes

- The mock uses IndexedDB locally in the browser — refresh the page to reset state.
- Annotation CRUD operations go through the in-memory store and are logged to the console.
- The `activity-context-example.ts` file in `src/routes/` is the original example; the mock is an enhanced version moved to `src/mock/`.
- To reset annotations, close the tab or clear IndexedDB from DevTools > Application > Storage.
