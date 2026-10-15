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
datasets.

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
`train2017/`. Categories are set up per dataset in IDAH, so each file lists
its own dataset's categories, and every id (categories, videos, images,
annotations, tracks) counts from 1 in each file. To combine files, match
categories by `name`, not by `id`.

| Include medias | Contents |
| --- | --- |
| No medias (`none`) | `annotations/` and the report: labels only. |
| Original medias (`original`) | Labels, plus every exported frame as a JPEG, taken from the original video. |
| All medias (`all`) | Same as original. Streaming variants and thumbnails have no place in COCO. |

Files and folders are named after the dataset and the entry (without its
extension), with characters other than letters, digits, `.`, `-` and `_`
replaced by `_`. An entry with no name uses its uploaded file's name. When two
datasets, or two entries of a dataset, share a name, later ones get a suffix:
`street`, `street_2`. A dataset with nothing to export gets no file.

Only completed entries are exported unless "Completed Entries Only" is switched off.

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

One category per value of the dataset's bounding-box and polygon labeling
configurations, in configuration order.

- `name` is the IDAH category id, such as `human/civilian/armed`. Labels are not
  used because they repeat across a category tree ("armed" under several
  parents) and can be blank; ids are unique.
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
| `segmentation` | The outline as one polygon `[[x1, y1, x2, y2, …]]`, at least 3 points. For a box, its 4 corners. |
| `bbox` | The axis-aligned box around the outline, `[x, y, width, height]`. |
| `area` | The outline's area, always above 0. |
| `category_id` | The category in `categories`. |
| `iscrowd` | Always `0`. |
| `track_id` | The object this shape belongs to, the same on every frame (see Tracks). |
| `attributes.keyframe` | `true` when the shape is a keyframe stored in IDAH, `false` when it was computed between two keyframes. |
| `attributes.rotation` | Boxes only: the box's rotation in degrees, clockwise, from 0 to 360. It is already applied to `segmentation` and `bbox`; it is there to rebuild the rotated box. |
| `attributes.idah_id` | The IDAH annotation the shape comes from. |
| `attributes.*` | The annotation's IDAH properties, such as `occlusion`, as stored. |

### Frames between keyframes

IDAH stores a shape's keyframes only; the annotation tool computes every
frame in between when it draws the video. The export computes them the same
way, with a port of the tool's own code, so every exported frame shows what
annotators saw:

```
Shape in IDAH:   keyframe 10 (x=100) ........ keyframe 20 (x=200)
Exported:        frame 10  x=100  keyframe: true
                 frame 11  x=110  keyframe: false
                 ...
                 frame 20  x=200  keyframe: true
```

A shape is exported from its first to its last keyframe, within its start and
end frames. Boxes move and rotate linearly between keyframes. Polygons morph
as in the annotation tool, even when two keyframes have different numbers of
points.

Filter on `attributes.keyframe` to keep the stored keyframes only.

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

A summary of the export, so nothing is left out without a trace.

```json
{
  "datasets": 1,
  "videos": 8,
  "images": 371,
  "annotations": 5402,
  "interpolated_annotations": 4075,
  "image_files": 371,
  "skipped": {
    "videos_without_annotated_frames": 10
  },
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
  ],
  "warnings": []
}
```

| Field | Meaning |
| --- | --- |
| `datasets` | COCO files written, one per dataset. |
| `videos` | Videos across all files. |
| `images` | Images (frames) across all files. |
| `annotations` | Annotations across all files. |
| `interpolated_annotations` | How many of them were computed between keyframes (`keyframe: false`). |
| `image_files` | Frame images written to `images/`. `0` without medias; lower than `images` when some could not be extracted (see `warnings`). |
| `skipped` | Data left out, counted by reason (below). |
| `split_groups` | Groups exported as several tracks because their annotations have different categories: the dataset's file name, the video, the group, and the track each category became. |
| `warnings` | Problems with a whole entry, one message each (below). |

### skipped

| Reason | Meaning |
| --- | --- |
| `deleted` | A deleted annotation. |
| `no_category` | A box or polygon without a category. |
| `no_keyframes` | A box or polygon without any keyframe, so without geometry. |
| `zero_area` | A shape on one frame that lies outside the video: clamped to the frame, it is a line or a point. |
| `too_few_points` | A polygon on one frame with fewer than 3 points, which COCO tools would read as a box. |
| `unsupported_shape_type:<type>` | An annotation of a type COCO instances cannot hold. |
| `videos_without_annotated_frames` | An entry with no shape and no frame tag. |
| `datasets_without_annotated_frames` | A dataset with nothing to export; it gets no file. |

### warnings

| Message | Meaning |
| --- | --- |
| ``Entry `<name>` (<id>) skipped: video width and height are unknown.`` | The video's metadata is missing, so its shapes cannot be placed in pixels. Nothing of the entry is exported. |
| ``Entry `<name>` (<id>): N frames past the end of the video have no image.`` | Shapes run past the last frame of the video. Their annotations are exported; those frames have no image file. |
| ``Entry `<name>` (<id>): no images, the video could not be read (<error>).`` | The original video could not be downloaded or decoded. The entry's annotations are exported without images. |

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

# One group per video, frames in order.
session = fo.launch_app(dataset.group_by("video", order_by="frame_id"))
```

Each label shows its category name, `track_id`, `keyframe`, `rotation`,
`idah_id` and IDAH properties, all usable as filters (for example
`keyframe` to show the stored keyframes only).

## Limits

- Frame `N` is the `N`-th decoded frame of the video. This matches the
  annotation tool for constant frame rate videos; variable frame rate videos
  have not been checked.
- The original video is downloaded into memory before its frames are
  extracted, as in the UPD export.

## Code

| File | Role |
| --- | --- |
| `coco/exporter.rb` | `IdahVideo::Export::Coco::Exporter`, registered for `idah-video` in `sync.rb`. |
| `coco/writer.rb` | Writes one `instances_<dataset>.json`, streaming images and annotations through temporary files. |
| `coco/category_index.rb` | Builds `categories` from the labeling configurations. |
| `helpers/interpolator.rb`, `helpers/polygon_morph.rb` | Frames between keyframes: ports of the frontend's `utils/interpolation.ts` and of flubber 0.4.2. |
| `helpers/geometry.rb` | Pixels, rotation, clamping, box and area. |
| `helpers/frame_extractor.rb` | Extracts the exported frames with ffmpeg, in one pass per video. |
| `helpers/report.rb` | `export_report.json`. |
| `helpers/keys.rb` | Reads API data whatever its key type. |

Paths are relative to `backends/sync/idah_video/export/`. `helpers/`
(`IdahVideo::Export::Helpers`) is shared with the formats to come.

The interpolation must match the frontend exactly. Its specs check
`spec_data/interpolation_parity.json`, which the frontend test
`frontend/src/lib/utils/interpolation.parity.test.ts` generates from the real
code. After changing the interpolation or the flubber version, regenerate it:

```bash
npx vitest run -u src/lib/utils/interpolation.parity.test.ts
```

Run from `plugins/idah-video/frontend`, then run `bundle exec rspec` in
`plugins/idah-video/backends`.
