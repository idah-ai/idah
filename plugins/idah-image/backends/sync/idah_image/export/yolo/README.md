# YOLO (Image) export

Exports `idah-image` datasets as YOLO datasets in the
[Ultralytics layout](https://docs.ultralytics.com/datasets/), the one YOLOv5,
YOLOv8 and YOLO11 train with, for detection, segmentation or oriented boxes.
Every entry with a shape becomes an image with a label file, one line per
shape.

The export appears as **YOLO (Image)** in the export dialog for image
datasets. What it shares with the other image exports (general options, how
shapes are placed, names, and the export report) is described in the
[image exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
two options when YOLO (Image) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Task (`task`) | Detection (boxes), Segmentation (outlines), Oriented boxes (rotated) | Detection | The kind of model you will train; see [Which task?](#which-task) |
| Validation images (%) (`val_percent`) | 0 to 50 | 0 | Share of images put in `val`. 0 puts every image in `train`. |

### Which task?

YOLO models come in several kinds, and each needs its labels written its own
way. Pick the task that matches the model you will train; the export dialog
shows a short summary under each choice.

| Task | What each object becomes | Pick it when | Train with |
| --- | --- | --- | --- |
| **Detection (boxes)** `detect` | One upright box around the object. | You want to find and count objects. The most common kind, and the fastest to train. | `yolo detect` |
| **Segmentation (outlines)** `segment` | The object's outline, point by point. | You need each object's exact shape, for example to measure its area. | `yolo segment` |
| **Oriented boxes (rotated)** `obb` | A box turned to follow the object's angle. | Objects are long and tilted (boats, vehicles from above), where an upright box would hold a lot of background. | `yolo obb` |

The annotations themselves are the same for every task: only how they are
written changes. The [Label files](#label-files) section gives the exact line
for each shape.

## The zip

```
<dataset>/
  data.yaml
  labels/train/<entry>.txt
  labels/val/<entry>.txt          only with a validation share
  images/train/<entry>.<ext>      only when "Include medias" is original or all
  images/val/<entry>.<ext>
export_report.json
```

Each IDAH dataset is a YOLO dataset of its own, with its own classes.

Ultralytics finds an image's labels by swapping `images` for `labels` in its
path and the extension for `.txt`, so each image and its label file sit at the
same place in the two folders. Without medias, the labels are ready for images
you already have, named after their entries.

### Train and val

With a validation share, each image's side is chosen from its IDAH entry id,
so the same image lands on the same side in every export. With few images,
`val` can end up empty; `val` then points at `train`, and the report says so
in `warnings`.

## data.yaml

```yaml
train: images/train
val: images/val
names:
  0: vehicles/car
  1: water
```

- `names` maps each class number to one of the dataset's categories (see
  [Categories](../README.md#categories)), from 0, in the same order as
  the COCO export's category ids minus 1.
- Without a validation share, `val` points at `train`.
- There is no `path` key, so Ultralytics resolves `train` and `val` from the
  folder of `data.yaml`. Give it the file's absolute path.

## Label files

One line per shape, coordinates as fractions of the image's width and height,
with 6 decimals. Shapes are first placed in the image as in every image export
(see [Shapes](../README.md#shapes)): rotated as drawn, circles and ellipses as
64-point polygons, clamped to the image. Then, by task:

| Task | Line | A box | A polygon, circle or ellipse | A mask |
| --- | --- | --- | --- | --- |
| `detect` | `class cx cy w h` | The axis-aligned box around it, so a rotated box becomes the larger box that contains it. | The box around it. | The box around each piece. |
| `segment` | `class x1 y1 x2 y2 …` | Its 4 corners, rotation included. | Its points. | The outline of each piece, holes included. |
| `obb` | `class x1 y1 x2 y2 x3 y3 x4 y4` | Its 4 corners, rotation included. | The smallest rotated rectangle around it. | The smallest rotated rectangle around each piece. |

```
detect    0 0.637484 0.834611 0.004854 0.020315
segment   0 0.635057 0.824454 0.639911 0.824454 0.639911 0.844769 0.635057 0.844769
obb       0 0.635057 0.824454 0.639911 0.824454 0.639911 0.844769 0.635057 0.844769
```

`class` is the class number in `data.yaml`. A rotated box that crosses the
edge of the image is clamped corner by corner, so its OBB line is no longer an
exact rectangle; Ultralytics fits a rotated rectangle to it when it loads it.

### Masks

YOLO labels have no mask format: YOLOv8-seg and YOLO11-seg predict masks, but
train from polygons, which Ultralytics fills into masks itself. So a mask is
outlined: each separate piece becomes its own line, traced along its pixel
edges and simplified to within a pixel.

For `segment`, a piece's holes are kept. Each hole is joined to the outline by
a zero-width cut: the line runs from a vertex to the nearest hole, around the
hole, and back along the same segment.

```
 outline                         one line: … A, B, hole …, B, A, …
 A ──────────────┐
 │  B──────┐     │               A→B and B→A cancel out, so filling the
 │  │ hole │     │               polygon (even-odd or nonzero) leaves the
 │  └──────┘     │               hole empty.
 └───────────────┘
```

Ultralytics' own COCO converter joins an object's polygons the same way.
Filled at pixel centres, the lines cover the mask's pixels to within the
1-pixel simplification (about 94% overlap on 2–3 px wide grain boundaries,
more on solid shapes). Ultralytics' polygon fill also paints the pixels the
edge runs through, which slightly widens very thin shapes. Use the
[COCO export](../coco/README.md) to keep masks pixel for pixel.

`detect` and `obb` write each piece's box or smallest rotated rectangle, which
holes do not change.

Pieces covering fewer than 20 pixels are left out, and counted in the
report's `skipped` as `small_mask_pieces`. Masks drawn with a brush or
pre-annotated often hold thousands of such specks, and Ultralytics pads every
outline of an image to the length of its longest when it loads it: specks
next to one large outline would take gigabytes of memory per image.

YOLO polygons suit masks of objects. A mask that is a network of thin lines
with many holes, such as grain boundaries, is semantic segmentation: its
outline runs to hundreds of thousands of points, and Ultralytics pads every
other outline of the image to that length. Such a mask is still exported, and
the report warns about each one longer than 10,000 points; use the
[COCO export](../coco/README.md) for it.

Only images with at least one shape are exported, so there are no empty label
files (background images).

## What YOLO cannot hold

YOLO labels are a class and a shape. The rest of the IDAH data is not
exported; use the [COCO export](../coco/README.md) to keep it:

- annotation properties and rotation angles;
- masks pixel for pixel (see [Masks](#masks));
- image tags, counted in the report's `skipped` as
  `unsupported_shape_type:entry:root`.

Lines are left out of both formats (`unsupported_shape_type:idah-image:line`).
In the [export report](../README.md#export_reportjson), `images` counts label
files and `annotations` counts label lines.

## Training

```bash
pip install ultralytics
yolo detect train data=/abs/path/<dataset>/data.yaml model=yolo11n.pt
yolo segment train data=/abs/path/<dataset>/data.yaml model=yolo11n-seg.pt
yolo obb train data=/abs/path/<dataset>/data.yaml model=yolo11n-obb.pt
```

Use the command that matches the export's task.

## Viewing in FiftyOne

[FiftyOne](https://docs.voxel51.com/) imports each dataset's folder with its
YOLOv5 importer, which reads the Ultralytics layout. It needs
`pip install fiftyone`.

```python
import fiftyone as fo

dataset = fo.Dataset.from_dir(
    dataset_dir="<dataset>",
    dataset_type=fo.types.YOLOv5Dataset,
    yaml_path="data.yaml",
    split="train",                      # or "val"
    label_type="detections",            # "polylines" for segment and obb exports
)

session = fo.launch_app(dataset)
```

The labels are in the `ground_truth` field, named after their category.
FiftyOne's YOLOv5 importer has no rotated-box type, so an `obb` export's boxes
show as 4-point outlines.

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahImage::Export::Yolo::Exporter`, registered for `idah-image` in `sync.rb`. Declares the `task` and `val_percent` options. |

Everything else (reading entries, masks, geometry, image files, the report)
is in `../helpers/`, shared with the other image exports; see the
[image exports README](../README.md#for-developers).
