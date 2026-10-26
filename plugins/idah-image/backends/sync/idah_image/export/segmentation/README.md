# Mask Segmentation (Image) export

Exports `idah-image` datasets for semantic segmentation: one class mask per
image, where each pixel holds the class of the shape covering it, and 0 means
background. This is the label format semantic segmentation models train on
(U-Net, DeepLab, SegFormer, mmsegmentation), laid out as Pascal VOC does.

The export appears as **Mask Segmentation (Image)** in the export dialog for
image datasets. What it shares with the other image exports (general options,
how shapes are placed, names, and the export report) is described in the
[image exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
one option when Mask Segmentation (Image) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Shapes (`shapes`) | Filled (`filled`), Outlines (`outline`) | Filled | How boxes, polygons, circles and ellipses are painted. |

- **Filled** paints each shape's whole area. This is what semantic
  segmentation models train on: they learn a class for every pixel of an
  object.
- **Outlines** paints each shape's edge only, 1 pixel thick, the inside left as
  background. Use it when the boundaries are what a model should find (edge,
  contour or crack detection); a model trained on outlines learns that an
  object's inside is background.

Masks are painted pixel for pixel, and lines 1 pixel wide, either way.

## The zip

```
<dataset>/
  classes.json
  masks/<entry>.png
  images/<entry>.<ext>      only when "Include medias" is original or all
export_report.json
```

Each IDAH dataset is a folder of its own, with its own classes. A mask has the
name of its image, with `.png`, and the image's size.

## Masks

Each mask is an 8-bit palette PNG: a pixel's value is its class index, and the
palette gives each class its colour, so the file opens as a coloured image.
Training code reads the values directly:

```python
import numpy as np
from PIL import Image

classes = np.array(Image.open("masks/street.png"))   # (height, width), class indexes
```

Every shape of the image is painted with its class:

| IDAH shape | Painted as |
| --- | --- |
| Mask | Its pixels. |
| Bounding box, polygon | Filled, or with Outlines its edge: the pixels of the fill next to background. A box rotated as drawn. |
| Circle, ellipse | Filled from its 64-point outline, or with Outlines its outline drawn as a pixel circle (see below). An ellipse rotated as drawn. |
| Line | 1 pixel wide. |

A pixel belongs to a filled shape when its centre lies inside the shape, so
two shapes sharing an edge do not overlap.

Lines have no width in IDAH (the annotation tool draws them at the same
thickness on screen whatever the zoom), so they are painted 1 pixel wide.
With Outlines, circles, and ellipses turned by a multiple of 90 degrees, are
drawn with the midpoint algorithm, as paint programs draw them: symmetric, closed and 1 pixel
thick. Their centre and radii are rounded to the pixel grid for this, so they
move by half a pixel at most. An ellipse at any other angle is traced along
its exact curve, and also closed and 1 pixel thick. Neither uses the 64-point
outline of the COCO and YOLO exports.

### Overlaps

Shapes are painted in the order they were created, as the annotation tool
stacks them, so where shapes overlap the pixel takes the class of the shape
created last. A large shape drawn after smaller ones covers them: a region
box drawn around finished work, for example, hides the masks inside it.

Only images with at least one shape are exported.

## classes.json

```json
[
  { "index": 0, "name": "background", "color": [0, 0, 0] },
  { "index": 1, "name": "car", "color": [0, 150, 135] },
  { "index": 2, "name": "road", "color": [0, 128, 0] }
]
```

- `index` is the pixel value in the masks. Classes follow the order of the
  dataset's labeling configuration (boxes, polygons, circles, ellipses and
  masks, then lines), as in the COCO export, where `index` is the COCO
  category id.
- `name` is the IDAH category id, such as `vehicles/car` (see
  [Categories](../README.md#categories)).
- `color` is the category's colour in the labeling configuration, or Pascal
  VOC's colour for its index when it has none. It is the colour of that index
  in every mask's palette.

A mask holds 255 classes besides background. Shapes of a later class are left
out, and counted in the report as `too_many_classes`.

## What masks cannot hold

A mask is a class per pixel. The rest of the IDAH data is not exported; use
the [COCO export](../coco/README.md) to keep it:

- which pixels belong to which object (instances): touching objects of a
  class merge;
- annotation properties and rotation angles;
- pixels under a shape painted later (see Overlaps);
- image tags, counted in the report's `skipped` as
  `unsupported_shape_type:entry:root`.

In the [export report](../README.md#export_reportjson), `images` counts mask
files and `annotations` counts painted shapes.

## Viewing

The PNGs open as coloured images in any viewer. To see a mask over its image:

```python
import numpy as np
from PIL import Image

image = Image.open("images/street.jpg").convert("RGB")
mask = Image.open("masks/street.png")
alpha = Image.fromarray(np.where(np.array(mask) > 0, 160, 0).astype(np.uint8))
image.paste(mask.convert("RGB"), (0, 0), alpha)
image.show()
```

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahImage::Export::Segmentation::Exporter`, registered for `idah-image` in `sync.rb`. Declares the `shapes` option. |

Painting is in `../helpers/canvas.rb`, the PNG writer in `../helpers/png.rb`;
everything else (reading entries, masks, geometry, image files, the report)
is in `../helpers/`, shared with the other image exports; see the
[image exports README](../README.md#for-developers).
