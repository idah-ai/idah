# Mock Development Setup

This directory provides a standalone mock environment for developing the **idah-image** plugin without needing the full IDAH backend stack.

## Quick Start

1. **Place your image file** in `static/` — see [`static/README.md`](../static/README.md) for details.

   By default, the mock expects a file at `static/mock-image.png`. You can also edit `src/routes/mock/mock-driver.ts` and change the `_media` field to point to any image source.

2. **Start the dev server**:

   ```bash
   cd plugins/idah-image/frontend
   pnpm dev
   ```

3. **Open your browser** at `http://localhost:5173` — the plugin will mount immediately with sample data.

## How It Works

The mock is a self-contained `IIdahDriverV2` implementation (`IdahDriverV2`) that simulates the host application. It provides:

| Feature             | Implementation                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Entry metadata      | Hardcoded entry ID, workflow step                                                                            |
| Annotation storage  | In-memory `InMemoryStore` with 3 pre-seeded annotations (bounding boxes + polygon)                           |
| Label configuration | 6 categories for `idah-image:bounding-box`, 3 for `idah-image:polygon`, with conditional property visibility |
| Media               | Image URL from `media.url`; metadata returns 1920×1080, 30 fps, 60s duration                                 |
| Notes               | No-op stubs with console logging                                                                             |
| Commands            | Wired to local `CommandManagerV2` (undo/redo stack, palette, shortcuts)                                      |
| Toolbar             | Registered via `ToolbarManagerV2`                                                                            |
| Icons               | SVG imports from `$lib/assets/icons/`                                                                        |

## Customizing the Mock

### Change the Image Source

In `src/routes/mock/mock-driver.ts`, update the `_media` property in the constructor:

```ts
private _media: IMediaInfo = {
  id: "mock-entry-v2-001",
  resource: "mock-entry-v2-001",
  key: "",
  mime_type: "image/png",
  filename: "sample.png",
  url: "/your-image.png",
  meta: { duration: 0, fps: 0, width: 1920, height: 1080 },
};
```

### Add More Sample Annotations

Edit the `SAMPLE_ANNOTATIONS` array in `src/routes/mock/mock-driver.ts`. Each annotation follows the `IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue>` interface:

```ts
{
  id: uuidv7(),
  shape: {
    type: "idah-image:bounding-box",
    start: 0,
    end: 100,
    frames: [
      {
        frame: 0,
        points: [
          [0.1, 0.1], [0.3, 0.1],
          [0.3, 0.3], [0.1, 0.3],
        ],
        angle: 0,
      },
      {
        frame: 100,
        points: [
          [0.12, 0.12], [0.32, 0.12],
          [0.32, 0.32], [0.12, 0.32],
        ],
        angle: 5,
      },
    ],
  } as IImageAnnotationShape,
  value: { category: "vehicles/car", label: "car" },
}
```

### Change Label Categories

Edit the `_config` property in the constructor. The config is keyed by shape type (`"idah-image:bounding-box"`, `"idah-image:polygon"`):

```ts
"idah-image:bounding-box": {
  values: [
    { id: "vehicles/car", color: "#F6402B", label: "Car", text_color: "#FFFFFF", description: "A car" },
    // ...
  ],
  properties: [
    {
      id: "wheels",
      type: "integer",
      label: "Number of wheels",
      format: { minimum: 0, maximum: 24, step: 1 },
      required: true,
      visibility: [
        "in",
        [["get", ["annotation.category"]], [["vehicles/car", "vehicles/bus", "vehicles/van", "vehicles/truck"]]],
      ],
      description: "How many wheels does the object have?",
    },
  ],
},
```

### Conditional Property Visibility

Properties can have AST-based `visibility` rules that reference the annotation's `value` fields. The `getFilteredConfig(shapeType, value, objectName)` method evaluates these rules using `AstProcessor`. The default `objectName` is `"annotation"`, so visibility expressions use `annotation.category`, `annotation.attributes.*`, etc.

## Notes

- The mock uses an in-memory store — refresh the page to reset state.
- Annotation CRUD operations go through the `InMemoryStore` adapters and are visible in the UI immediately.
- To reset annotations, simply refresh the browser tab.
