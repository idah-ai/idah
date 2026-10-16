# Mask Segmentation (Video) export

Exports `idah-video` datasets for semantic segmentation: one class mask per
frame a box or polygon covers, where each pixel holds the class of the shape
covering it, and 0 means background. This is the label format semantic
segmentation models train on (U-Net, DeepLab, SegFormer, mmsegmentation), laid
out as Pascal VOC does, frame by frame.

The export appears as **Mask Segmentation (Video)** in the export dialog for
video datasets. What it shares with the other video exports (general options,
which frames are exported, how shapes are placed, names, and the export
report) is described in the [video exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
two options when Mask Segmentation (Video) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Frames (`frames`) | All frames (`all`), Keyframes only (`keyframes`) | All frames | Which frames get a mask. |
| Shapes (`shapes`) | Filled (`filled`), Outlines (`outline`) | Filled | How boxes and polygons are painted. |

- **All frames** writes a mask for every frame a shape covers, frames between
  keyframes included (see [Frames](../README.md#frames)).
- **Keyframes only** writes the frames where annotators stored a keyframe. A
  kept frame still paints every shape on it, including those computed there:
  leaving one out would turn that object into background.

- **Filled** paints each shape's whole area. This is what semantic
  segmentation models train on: they learn a class for every pixel of an
  object.
- **Outlines** paints each shape's edge only, 1 pixel thick, the inside left as
  background. Use it when the boundaries are what a model should find (edge,
  contour or crack detection); a model trained on outlines learns that an
  object's inside is background.

## The zip

```
<dataset>/
  classes.json
  masks/<video>/frame_000012.png
  images/<video>/frame_000012.jpg     only when "Include medias" is original or all
export_report.json
```

Each IDAH dataset is a folder of its own, with its own classes. A frame's mask
and image share their path, with `.png` and `.jpg`, and the video's size.

## Masks

Each mask is an 8-bit palette PNG: a pixel's value is its class index, and the
palette gives each class its colour, so the file opens as a coloured image.
Training code reads the values directly:

```python
import numpy as np
from PIL import Image

classes = np.array(Image.open("masks/street/frame_000012.png"))   # (height, width), class indexes
```

Every box and polygon visible on the frame is painted with its class, a box
rotated as drawn: filled, or with Outlines its edge, the pixels of the fill
next to background. A pixel belongs to a shape when its centre lies inside the
shape, so two shapes sharing an edge do not overlap.

### Overlaps

Shapes are painted in the order they were created, as the annotation tool
stacks them, so where shapes overlap the pixel takes the class of the shape
created last.

## classes.json

```json
[
  { "index": 0, "name": "background", "color": [0, 0, 0] },
  { "index": 1, "name": "human/civilian/armed", "color": [235, 20, 97] }
]
```

- `index` is the pixel value in the masks. Classes follow the order of the
  dataset's labeling configuration, as in the COCO export, where `index` is
  the COCO category id.
- `name` is the IDAH category id (see [Categories](../README.md#categories)).
- `color` is the category's colour in the labeling configuration, or Pascal
  VOC's colour for its index when it has none. It is the colour of that index
  in every mask's palette.

A mask holds 255 classes besides background. Shapes of a later class are left
out, and counted in the report as `too_many_classes`.

## What masks cannot hold

A mask is a class per pixel. The rest of the IDAH data is not exported; use
the [COCO export](../coco/README.md) to keep it:

- which pixels belong to which object (instances) and tracks: touching
  objects of a class merge;
- annotation properties, keyframes and rotation angles;
- pixels under a shape painted later (see Overlaps);
- frame tags and entry-level tags, counted in the report's `skipped` as
  `unsupported_shape_type:idah-video:frame` and
  `unsupported_shape_type:entry:root`.

In the [export report](../README.md#export_reportjson), `images` counts mask
files, `annotations` counts painted shapes, and `split_groups` is always
empty.

## Viewing

The PNGs open as coloured images in any viewer. To see a mask over its frame:

```python
import numpy as np
from PIL import Image

frame = Image.open("images/street/frame_000012.jpg").convert("RGB")
mask = Image.open("masks/street/frame_000012.png")
alpha = Image.fromarray(np.where(np.array(mask) > 0, 160, 0).astype(np.uint8))
frame.paste(mask.convert("RGB"), (0, 0), alpha)
frame.show()
```

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahVideo::Export::Segmentation::Exporter`, registered for `idah-video` in `sync.rb`. Declares the `frames` and `shapes` options. |

Painting is in `../helpers/canvas.rb`, the PNG writer in `../helpers/png.rb`;
everything else (reading entries, frames between keyframes, geometry, frame
images, the report) is in `../helpers/`, shared with the other video exports;
see the [video exports README](../README.md#for-developers).
