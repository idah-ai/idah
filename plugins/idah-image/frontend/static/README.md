# Mock Image Media

Download a sample image for annotation, for example from:

- https://www.pexels.com/search/city%20street/ (or any free stock photo)

Recommendation: choose a 1920×1080 image with multiple objects (cars, people, traffic signs) to make the mock more realistic.

## Setup

Place your image file here and name it `mock-image.png` (or `.jpg`):

```
static/
└── mock-image.png
```

Then update `src/routes/mock/mock-driver.ts` if your image has a different filename or size:

```ts
private _media: IMediaInfo = {
  id: "mock-entry-v2-001",
  resource: "mock-entry-v2-001",
  key: "",
  mime_type: "image/png",           // or "image/jpeg"
  filename: "mock-image.png",        // your filename
  url: "/mock-image.png",            // served from static/
  meta: { duration: 0, fps: 0, width: 1920, height: 1080 },
};
```

No transcoding needed — the idah-image plugin loads images directly via `<img>` or canvas.
