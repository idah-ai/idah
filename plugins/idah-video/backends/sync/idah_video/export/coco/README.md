# COCO (Video) export

Exports `idah-video` datasets as [COCO](https://cocodataset.org/#format-data)
instances files, one per dataset. Every frame a box or polygon covers becomes
a COCO image, and every shape visible on that frame becomes an annotation.

The standard COCO fields are complete on their own, so any COCO tool
(`pycocotools`, detection frameworks) reads the export as an image dataset.
The video data rides along in the extra fields that COCO video datasets
(YouTube-VIS, TAO) use, and which COCO tools ignore: a top-level `videos`
list, `video_id` and `frame_id` on images, `track_id` on annotations, and
`attributes`.

The export appears as **COCO (Video)** in the export dialog for video
datasets. What it shares with the other video exports (export options, which
frames are exported, how shapes are placed, names, and the export report) is
described in the [video exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
two options when COCO (Video) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Frames (`frames`) | All frames (`all`), Keyframes only (`keyframes`) | All frames | Which frames become images. |
| Boxes (`boxes`) | Polygons (`polygon`), Rectangles (`rectangle`) | Polygons | How boxes are written; see [Boxes](#boxes). |

### Frames

- **All frames** exports every frame a shape covers, frames between keyframes
  included (see [Frames](../README.md#frames)).
- **Keyframes only** exports only the frames where annotators stored a
  keyframe, or a frame tag: a much smaller dataset, made of the frames people
  drew. A kept frame still lists every shape visible on it, including other
  objects whose shape is computed there (`attributes.keyframe: false`): COCO
  takes an image's annotations as complete, so leaving one out would turn that
  object into background. To keep the stored shapes only, filter on
  `attributes.keyframe`.

### Boxes

COCO has no box-only annotation: every object has a `segmentation` beside its
`bbox`, and tools read one differently from the other.

| Boxes | `segmentation` of an upright box | Good for |
| --- | --- | --- |
| **Polygons** (`polygon`, default) | its 4 corners | Every COCO tool. `pycocotools` (`annToMask`, mask evaluation) and segmentation training read the box as its own mask. Annotation tools import it as a polygon. |
| **Rectangles** (`rectangle`) | `[]`, the box is its `bbox` only | Annotation tools that import a box without `segmentation` as a rectangle. `pycocotools`' `annToMask` and mask evaluation fail on an empty `segmentation`: filter these annotations out before using masks. Detection training and box evaluation are not affected. |

A rotated box keeps its 4 corners either way, as a `bbox` cannot hold a
rotation; annotation tools import it as a polygon.

## The zip

```
annotations/
  instances_<dataset>.json       one COCO file per dataset
images/                          only when "Include medias" is original or all
  <dataset>/<video>/frame_000012.jpg
export_report.json               what was exported and what was left out, for the whole export
```

Each dataset is a complete COCO file of its own, paired with its own image
folder, the way COCO itself ships `instances_train2017.json` with
`train2017/`. Every id (categories, videos, images, annotations, tracks)
counts from 1 in each file. To combine files, match categories by `name`, not
by `id`.

## instances_<dataset>.json

```jsonc
{
  "info": { "description": "IDAH export", "version": "1.0", "year": 2026,
            "contributor": "IDAH", "url": "", "date_created": "2026-10-14T10:00:00Z" },
  "licenses": [],
  "categories": [
    { "id": 1, "name": "vehicles/car", "supercategory": "vehicles" }
  ],
  "videos": [{
    "id": 1, "name": "street.mp4", "width": 1920, "height": 1080,
    "fps": 25.0, "length": 1500,
    "idah_entry_id": "019e…", "idah_dataset_id": "019d…",
    "attributes": { "category": "rain", "visibility": "low" }
  }],
  "images": [{
    "id": 1, "file_name": "street/frame_000012.jpg", "width": 1920, "height": 1080,
    "video_id": 1, "frame_id": 12,
    "attributes": { "frame_tags": [{ "category": "night", "lighting": "street lamps" }] }
  }],
  "annotations": [{
    "id": 1, "image_id": 1, "category_id": 1, "iscrowd": 0,
    "segmentation": [[812.4, 300.1, 1032.4, 300.1, 1032.4, 440.6, 812.4, 440.6]],
    "bbox": [812.4, 300.1, 220.0, 140.5],
    "area": 30910.0,
    "track_id": 3,
    "attributes": { "occlusion": "Partial", "idah_id": "019f…", "keyframe": false, "rotation": 0.0 }
  }]
}
```

All coordinates are in pixels of the original video, clamped to the frame and
rounded to 2 decimals. Ids count from 1 in each file.

### categories

The dataset's categories (see [Categories](../README.md#categories)).

- `name` is the IDAH category id, such as `human/civilian/armed`.
- `supercategory` is the parent path (`human/civilian`), or `""` at the top.

Frame tag and entry-level categories are not listed here (see below).

### videos

One per exported entry.

| Field | Meaning |
| --- | --- |
| `name` | The entry's name, or its uploaded file's name. |
| `width`, `height` | The original video's size in pixels. |
| `fps` | Frames per second. |
| `length` | Number of frames, `floor(duration × fps)`, as the annotation tool counts them. |
| `idah_entry_id`, `idah_dataset_id` | Where the video comes from in IDAH. |
| `attributes` | The entry-level tag (`entry:root`): its `category` and properties. Absent when the entry has none. |

### images

One per exported frame.

| Field | Meaning |
| --- | --- |
| `file_name` | Relative to the dataset's image folder, `images/<dataset>/`: `<video>/frame_NNNNNN.jpg`. |
| `width`, `height` | The video's size. |
| `video_id` | The video in `videos`. |
| `frame_id` | The frame number, from 0, as in the annotation tool. |
| `attributes.frame_tags` | The frame tags (`idah-video:frame`) on this frame, each with its `category` and properties. Absent when untagged. |

A frame is exported when at least one shape is visible on it, or when it is
tagged. Frames with neither are left out.

### annotations

One per shape per frame.

| Field | Meaning |
| --- | --- |
| `segmentation` | The outline as one polygon `[[x1, y1, x2, y2, …]]`, at least 3 points. For a box, its 4 corners, or `[]` for an upright box with Boxes: Rectangles (see [Boxes](#boxes)). |
| `bbox` | The axis-aligned box around the outline, `[x, y, width, height]`. |
| `area` | The outline's area, always above 0. |
| `category_id` | The category in `categories`. |
| `iscrowd` | Always `0`. |
| `track_id` | The object this shape belongs to, the same on every frame (see Tracks). |
| `attributes.keyframe` | `true` when the shape is a keyframe stored in IDAH, `false` when it was computed between two keyframes (see [Frames](../README.md#frames)). Filter on it to keep the stored keyframes only. |
| `attributes.rotation` | Boxes only: the box's rotation in degrees, clockwise, from 0 to 360. It is already applied to `segmentation` and `bbox`; it is there to rebuild the rotated box. |
| `attributes.idah_id` | The IDAH annotation the shape comes from. |
| `attributes.*` | The annotation's IDAH properties, such as `occlusion`, as stored. |

### Tracks

Shapes of one object share a `track_id` across frames. In IDAH an object can
be several annotations tied together by a group: the first one has no
`group_id`, and the following ones carry its id. All of them get the same
`track_id`.

A track has one category. When an object's annotations change category (for
example from `tobedefined` to `transported`), each category becomes its own
track, and the report lists the group under `split_groups`.

`track_id` counts from 1 and is unique in its file, not per video.

## export_report.json

The report is described in the [video exports README](../README.md#export_reportjson).
For COCO, `split_groups` lists every group exported as several tracks:

```json
"split_groups": [
  {
    "dataset": "05_2026_DRAGONFLY_330_AIRATTACK_NP_BATCH_B01_HUMAN",
    "video": "NP-AIRATTACK-330-B-00002-000-002500980000-002503060000.ts",
    "idah_entry_id": "019ef9dd-0ce9-7959-9cbb-9b968d8b9bc7",
    "group": "019f64e5-2f26-7951-a342-75f893546e70",
    "tracks": [
      { "category": "human/undefined/tobedefined/-", "track_id": 70 },
      { "category": "human/undefined/transported/-", "track_id": 71 }
    ]
  }
]
```

Each gives the dataset's file name, the video and its IDAH entry, the group,
and the track each category became, so the split can be checked in IDAH.

## Reading the export

```python
from pycocotools.coco import COCO

coco = COCO("annotations/instances_<dataset>.json")     # images in images/<dataset>/
image = coco.loadImgs(coco.getImgIds())[0]
annotations = coco.loadAnns(coco.getAnnIds(imgIds=image["id"]))
mask = coco.annToMask(annotations[0])

# Video data, from the same JSON:
video = next(v for v in coco.dataset["videos"] if v["id"] == image["video_id"])
track = [a for a in coco.dataset["annotations"] if a["track_id"] == annotations[0]["track_id"]]
keyframes_only = [a for a in coco.dataset["annotations"] if a["attributes"]["keyframe"]]
```

## Viewing in FiftyOne

[FiftyOne](https://docs.voxel51.com/) imports each dataset's file with its
image folder. It needs `pip install fiftyone pycocotools`.

```python
import json

import fiftyone as fo

labels_path = "annotations/instances_<dataset>.json"
dataset = fo.Dataset.from_dir(
    dataset_type=fo.types.COCODetectionDataset,
    data_path="images/<dataset>",
    labels_path=labels_path,
    label_types=["detections", "segmentations"],
    extra_attrs=True,  # track_id and attributes become label fields
    include_id=True,   # keeps the COCO image id as `coco_id`
)

# FiftyOne's COCO importer skips image-level extras: copy each image's video
# and frame number from the JSON.
coco = json.load(open(labels_path))
images = {i["id"]: i for i in coco["images"]}
videos = {v["id"]: v for v in coco["videos"]}
for sample in dataset.iter_samples(autosave=True):
    image = images[sample["coco_id"]]
    sample["video"] = videos[image["video_id"]]["name"]
    sample["frame_id"] = image["frame_id"]

# The label attributes (occlusion, track_id, keyframe, ...) are imported as
# undeclared fields, which the app hides until they are declared.
dataset.add_dynamic_sample_fields()

# One group per video, frames in order.
session = fo.launch_app(dataset.group_by("video", order_by="frame_id"))
```

Each label shows its category name, `track_id`, `keyframe`, `rotation`,
`idah_id` and IDAH properties, all usable as filters (for example
`keyframe` to show the stored keyframes only).

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahVideo::Export::Coco::Exporter`, registered for `idah-video` in `sync.rb`. Declares the `frames` option. |
| `writer.rb` | Writes one `instances_<dataset>.json`, streaming images and annotations through temporary files. |

Everything else (reading entries, frames between keyframes, geometry, frame
images, the report) is in `../helpers/`, shared with the other video exports;
see the [video exports README](../README.md#for-developers).
