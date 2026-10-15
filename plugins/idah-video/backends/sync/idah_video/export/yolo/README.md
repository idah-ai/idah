# YOLO Detect (Video) export

Exports `idah-video` datasets as YOLO detection datasets in the
[Ultralytics layout](https://docs.ultralytics.com/datasets/detect/), the one
YOLOv5, YOLOv8 and YOLO11 train with. Every frame a box or polygon covers
becomes an image with a label file, one line per visible shape.

The export appears as **YOLO Detect (Video)** in the export dialog for video
datasets. What it shares with the other video exports (export options, which
frames are exported, how shapes are placed, names, and the export report) is
described in the [video exports README](../README.md).

## The zip

```
<dataset>/
  data.yaml
  labels/train/<video>/frame_000012.txt
  images/train/<video>/frame_000012.jpg    only when "Include medias" is original or all
export_report.json
```

Each IDAH dataset is a YOLO dataset of its own, with its own classes.

Ultralytics finds an image's labels by swapping `images` for `labels` in its
path and the extension for `.txt`, so each frame's image and label file sit
at the same place in the two folders. Without medias, the labels are ready
for frames you already have, placed the same way.

## data.yaml

```yaml
train: images/train
val: images/train
names:
  0: human/civilian/inwater
  1: being/undefined/undefined
```

- `names` maps each class number to one of the dataset's categories (see
  [Categories](../README.md#categories)), from 0, in the same order as
  the COCO export's category ids minus 1.
- Every frame is in `train`, and `val` points at the same images: the export
  does not split. Split the frames yourself before training; whole videos are
  the safer unit, since neighbouring frames look alike.
- There is no `path` key, so Ultralytics resolves `train` and `val` from the
  folder of `data.yaml`. Give it the file's absolute path.

## Label files

One line per shape visible on the frame:

```
class cx cy w h
0 0.637484 0.834611 0.004854 0.020315
```

| Value | Meaning |
| --- | --- |
| `class` | The class number in `data.yaml`. |
| `cx`, `cy` | The box centre, as fractions of the frame's width and height. |
| `w`, `h` | The box size, as fractions of the frame's width and height. |

Values have 6 decimals. Shapes are placed in the frame as in every video
export (see [Shapes in pixels](../README.md#shapes-in-pixels)), then:

- a box, rotation included, becomes the axis-aligned box around it, so a
  rotated box becomes the larger box that contains it;
- a polygon becomes the box around it.

Only frames with at least one box are exported, so there are no empty label
files (background images).

## What YOLO cannot hold

YOLO detection labels are a class and a box. The rest of the IDAH data is not
exported; use the [COCO export](../coco/README.md) to keep it:

- tracks (which boxes are the same object across frames), keyframes and
  rotation;
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
```

The objects in aerial footage are small (often under 20 px), so a larger
`imgsz` than the default 640 usually helps.

## Viewing in FiftyOne

[FiftyOne](https://docs.voxel51.com/) imports each dataset's folder with its
YOLOv5 importer, which reads the Ultralytics layout. It needs
`pip install fiftyone`.

```python
import os
import re

import fiftyone as fo

dataset = fo.Dataset.from_dir(
    dataset_dir="<dataset>",
    dataset_type=fo.types.YOLOv5Dataset,
    yaml_path="data.yaml",
    split="train",
)

# YOLO keeps no video fields: the video is the image's folder, the frame its name.
for sample in dataset.iter_samples(autosave=True):
    sample["video"] = os.path.basename(os.path.dirname(sample.filepath))
    sample["frame_id"] = int(re.search(r"frame_(\d+)", sample.filepath).group(1))

# One group per video, frames in order.
session = fo.launch_app(dataset.group_by("video", order_by="frame_id"))
```

The boxes are in the `ground_truth` field, labelled with their category name.

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahVideo::Export::Yolo::Exporter`, registered for `idah-video` in `sync.rb`. |

Everything else (reading entries, frames between keyframes, geometry, frame
images, the report) is in `../helpers/`, shared with the other video exports;
see the [video exports README](../README.md#for-developers).
