# YOLO (Video) export

Exports `idah-video` datasets as YOLO datasets in the
[Ultralytics layout](https://docs.ultralytics.com/datasets/), the one YOLOv5,
YOLOv8 and YOLO11 train with, for detection, segmentation or oriented boxes.
Every frame a box or polygon covers becomes an image with a label file, one
line per visible shape.

The export appears as **YOLO (Video)** in the export dialog for video
datasets. What it shares with the other video exports (general options, which
frames are exported, how shapes are placed, names, and the export report) is
described in the [video exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
two options when YOLO (Video) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Task (`task`) | Detection (boxes), Segmentation (outlines), Oriented boxes (rotated) | Detection | The kind of model you will train; see [Which task?](#which-task) |
| Validation videos (%) (`val_percent`) | 0 to 50 | 0 | Share of videos put in `val`. 0 puts every frame in `train`. |

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
written changes. A rotated box in IDAH becomes an upright box for detection,
its 4 corners for segmentation, and itself for oriented boxes; a polygon
becomes the box around it, its points, or the smallest rotated box around it.
The [Label files](#label-files) section gives the exact line for each.

## The zip

```
<dataset>/
  data.yaml
  labels/train/<video>/frame_000012.txt
  labels/val/<video>/frame_000003.txt       only with a validation share
  images/train/<video>/frame_000012.jpg     only when "Include medias" is original or all
  images/val/<video>/frame_000003.jpg
export_report.json
```

Each IDAH dataset is a YOLO dataset of its own, with its own classes.

Ultralytics finds an image's labels by swapping `images` for `labels` in its
path and the extension for `.txt`, so each frame's image and label file sit
at the same place in the two folders. Without medias, the labels are ready
for frames you already have, placed the same way.

### Train and val

With a validation share, whole videos go to `val`: neighbouring frames look
alike, so a video split across `train` and `val` would leak into validation.
Each video's side is chosen from its IDAH entry id, so the same video lands on
the same side in every export.

The share applies to videos, not frames: busy videos weigh more, so `val` can
hold more or fewer frames than the share suggests. With few videos, `val` can
end up empty; `val` then points at `train`, and the report says so in
`warnings`.

## data.yaml

```yaml
train: images/train
val: images/val
names:
  0: human/civilian/inwater
  1: being/undefined/undefined
```

- `names` maps each class number to one of the dataset's categories (see
  [Categories](../README.md#categories)), from 0, in the same order as
  the COCO export's category ids minus 1.
- Without a validation share, `val` points at `train`.
- There is no `path` key, so Ultralytics resolves `train` and `val` from the
  folder of `data.yaml`. Give it the file's absolute path.

## Label files

One line per shape visible on the frame, coordinates as fractions of the
frame's width and height, with 6 decimals. Shapes are first placed in the
frame as in every video export (see
[Shapes in pixels](../README.md#shapes-in-pixels)): rotated as drawn and
clamped to the frame. Then, by task:

| Task | Line | A box | A polygon |
| --- | --- | --- | --- |
| `detect` | `class cx cy w h` | The axis-aligned box around it, so a rotated box becomes the larger box that contains it. | The box around it. |
| `segment` | `class x1 y1 x2 y2 …` | Its 4 corners, rotation included. | Its points. |
| `obb` | `class x1 y1 x2 y2 x3 y3 x4 y4` | Its 4 corners, rotation included. | The smallest rotated rectangle around it. |

```
detect    0 0.637484 0.834611 0.004854 0.020315
segment   0 0.635057 0.824454 0.639911 0.824454 0.639911 0.844769 0.635057 0.844769
obb       0 0.635057 0.824454 0.639911 0.824454 0.639911 0.844769 0.635057 0.844769
```

`class` is the class number in `data.yaml`. A rotated box that crosses the
edge of the frame is clamped corner by corner, so its OBB line is no longer an
exact rectangle; Ultralytics fits a rotated rectangle to it when it loads it.

Only frames with at least one shape are exported, so there are no empty label
files (background images).

## What YOLO cannot hold

YOLO labels are a class and a shape. The rest of the IDAH data is not
exported; use the [COCO export](../coco/README.md) to keep it:

- tracks (which shapes are the same object across frames) and keyframes;
- annotation properties, such as `occlusion`;
- frame tags and entry-level tags, counted in the report's `skipped` as
  `unsupported_shape_type:idah-video:frame` and
  `unsupported_shape_type:entry:root`;
- the video's details (fps, frame count). The video is each frame's folder and
  the frame number is in its file name.

In the [export report](../README.md#export_reportjson), `images` counts
label files, `annotations` counts label lines, and `split_groups` is always
empty.

## Training

```bash
pip install ultralytics
yolo detect train data=/abs/path/<dataset>/data.yaml model=yolo11n.pt imgsz=1280
yolo segment train data=/abs/path/<dataset>/data.yaml model=yolo11n-seg.pt imgsz=1280
yolo obb train data=/abs/path/<dataset>/data.yaml model=yolo11n-obb.pt imgsz=1280
```

Use the command that matches the export's task. The objects in aerial footage
are small (often under 20 px), so a larger `imgsz` than the default 640
usually helps.

## Viewing in FiftyOne

[FiftyOne](https://docs.voxel51.com/) imports a detection export's folder with
its YOLOv5 importer, which reads the Ultralytics layout. It needs
`pip install fiftyone`.

```python
import os
import re

import fiftyone as fo

dataset = fo.Dataset.from_dir(
    dataset_dir="<dataset>",
    dataset_type=fo.types.YOLOv5Dataset,
    yaml_path="data.yaml",
    split="train",                      # or "val"
)

# YOLO keeps no video fields: the video is the image's folder, the frame its name.
for sample in dataset.iter_samples(autosave=True):
    sample["video"] = os.path.basename(os.path.dirname(sample.filepath))
    sample["frame_id"] = int(re.search(r"frame_(\d+)", sample.filepath).group(1))

# One group per video, frames in order.
session = fo.launch_app(dataset.group_by("video", order_by="frame_id"))
```

The boxes are in the `ground_truth` field, labelled with their category name.
This was tried with `detect` exports; to look at shapes, the
[COCO export](../coco/README.md) shows outlines in FiftyOne.

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahVideo::Export::Yolo::Exporter`, registered for `idah-video` in `sync.rb`. Declares the `task` and `val_percent` options. |

Everything else (reading entries, frames between keyframes, geometry, frame
images, the report) is in `../helpers/`, shared with the other video exports;
see the [video exports README](../README.md#for-developers).
