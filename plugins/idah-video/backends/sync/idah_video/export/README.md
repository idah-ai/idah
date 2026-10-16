# Video exports

The video plugin adds export formats for `idah-video` datasets to the sync
service. They appear in the export dialog next to the platform's own
Universal Portable Dataset (UPD) export.

| Format | Writes | Keeps | Details |
| --- | --- | --- | --- |
| **COCO (Video)** | One COCO instances file per dataset: boxes, polygons and their outlines | Videos, frame numbers, tracks, keyframes, rotation, properties, frame and video tags | [COCO README](coco/README.md) |
| **YOLO (Video)** | One Ultralytics YOLO dataset per dataset: boxes, outlines or rotated boxes (Task option), with an optional validation share | Classes and shapes only | [YOLO README](yolo/README.md) |
| **Mask Segmentation (Video)** | One class mask PNG per frame: every box and polygon painted with its class | Classes and their colours only | [Mask Segmentation README](segmentation/README.md) |

Pick COCO to keep everything IDAH knows about the annotations, or to work
with tracking. Pick YOLO to train a detector, a segmentation model or an
oriented-box model right away. Pick Mask Segmentation to train a semantic
segmentation model, where every pixel gets a class.

This page covers what the formats share: which frames are exported, how
shapes are placed, how files are named, and the export report. Each format's
README covers its own files.

## Export options

| Option | Effect |
| --- | --- |
| Include medias: No medias (`none`) | Labels only, for when the frames are already at hand. |
| Include medias: Original medias (`original`) | Labels, plus every exported frame as a JPEG, taken from the original video. |
| Include medias: All medias (`all`) | Same as original. Streaming variants and thumbnails have no place in a dataset of frames. |
| Completed Entries Only | On by default: only completed entries are exported. Switch it off to export every entry. |

A format can add options of its own, shown in the dialog when it is selected;
COCO (Video) adds a choice of frames (all, or keyframes only) and of how boxes
are written (polygons, or rectangles), YOLO (Video) adds a task and a
validation share, and Mask Segmentation (Video) adds the same choice of frames
as COCO (see their READMEs).

A selection can hold several datasets, but only `idah-video` ones: an export
that includes a dataset of another modality fails.

## What is exported

### One output per dataset

Categories are set up per dataset in IDAH, so each dataset is exported on its
own: a COCO file, or a YOLO dataset, with its own categories and image
folder. Numbering (category ids, YOLO classes, image and track ids) restarts
in each. To combine datasets, match categories by name, not by number.

### Categories

A dataset's categories are the values of its bounding-box and polygon
labeling configurations, in configuration order. Each is named by its IDAH
id, such as `human/civilian/armed`: labels are not used because they repeat
across a category tree ("armed" under several parents) and can be blank,
while ids are unique. A category used by an annotation but missing from the
configuration is added at the end.

### Frames

A video is exported frame by frame, as images. Every frame a box or polygon
covers is exported, and each lists every shape visible on it, so every image
is fully labelled.

IDAH stores a shape's keyframes only; the annotation tool computes every frame
in between when it draws the video. The export computes them the same way,
with a port of the tool's own code, so every exported frame shows what
annotators saw:

```
Shape in IDAH:   keyframe 10 (x=100) ........ keyframe 20 (x=200)
Exported:        frame 10  x=100   stored
                 frame 11  x=110   computed
                 ...
                 frame 20  x=200   stored
```

- A shape is exported from its first to its last keyframe, within its start
  and end frames.
- Boxes move and rotate linearly between keyframes. Polygons morph as in the
  annotation tool, even when two keyframes have different numbers of points.
- Annotators usually set a keyframe every few frames. When the camera moves
  quickly between two keyframes, the computed frames can drift off the object
  and snap back on the next keyframe, exactly as the annotation tool shows
  them.

Frame numbers count from 0, as in the annotation tool, and appear in file
names as `frame_000012`.

### Shapes in pixels

Shapes are stored in IDAH as fractions of the frame. The export places them in
pixels of the original video:

- A rotated box is turned around its centre, clockwise, as the annotation tool
  draws it.
- Shapes are clamped to the frame. A shape that lies outside the frame, with
  no area once clamped, is skipped on that frame.
- A polygon with fewer than 3 points is skipped: tools read it as a box.

### Names

Folders and files are named after the dataset and the entry (without its
extension). Characters other than letters, digits, `.`, `-` and `_` become
`_`. An entry with no name uses its uploaded file's name. When two datasets,
or two entries of a dataset, share a name, later ones get a suffix: `street`,
`street_2`.

A video with nothing to export, and a dataset with nothing to export, are
left out and counted in the report.

### Frame images

With medias, the exported frames are extracted from the original video with
ffmpeg, in one pass per video, as `frame_NNNNNN.jpg`. A video that cannot be
read keeps its labels and gets no images; frames past the end of the video
get no image either. Both are reported as warnings.

## export_report.json

Every export has an `export_report.json` at the root of the zip, for the whole
export, so nothing is left out without a trace.

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
  "split_groups": [],
  "warnings": []
}
```

| Field | Meaning |
| --- | --- |
| `datasets` | Datasets exported: COCO files or YOLO datasets. |
| `videos` | Videos with at least one exported frame. |
| `images` | Frames exported: COCO images, YOLO label files, or mask PNGs. |
| `annotations` | Shapes exported, one per shape per frame: COCO annotations, YOLO label lines, or painted shapes. |
| `interpolated_annotations` | How many of them were computed between keyframes. |
| `image_files` | Frame images written. `0` without medias; lower than `images` when some could not be extracted (see `warnings`). |
| `skipped` | Data left out, counted by reason (below). |
| `split_groups` | COCO only: groups exported as several tracks because their annotations have different categories (see the COCO README). Always empty for YOLO and Mask Segmentation. |
| `warnings` | Problems with a whole entry, one message each (below). |

### skipped

| Reason | Meaning |
| --- | --- |
| `deleted` | A deleted annotation. |
| `no_category` | A box or polygon without a category. |
| `no_keyframes` | A box or polygon without any keyframe, so without geometry. |
| `zero_area` | A shape on one frame that lies outside the video: clamped to the frame, it is a line or a point. |
| `too_few_points` | A polygon on one frame with fewer than 3 points. |
| `unsupported_shape_type:<type>` | An annotation the format cannot hold. YOLO and Mask Segmentation count frame tags (`idah-video:frame`) and entry-level tags (`entry:root`) here; COCO keeps them. |
| `too_many_classes` | Mask Segmentation only: a shape of a dataset's 256th class or later, as a mask PNG holds 255 classes besides background. |
| `videos_without_annotated_frames` | An entry with nothing to export. |
| `datasets_without_annotated_frames` | A dataset with nothing to export; it gets no file or folder. |

### warnings

| Message | Meaning |
| --- | --- |
| ``Entry `<name>` (<id>) skipped: video width and height are unknown.`` | The video's metadata is missing, so its shapes cannot be placed in pixels. Nothing of the entry is exported. |
| ``Entry `<name>` (<id>): N frames past the end of the video have no image.`` | Shapes run past the last frame of the video. Their labels are exported; those frames have no image file. |
| ``Entry `<name>` (<id>): no images, the video could not be read (<error>).`` | The original video could not be downloaded or decoded. The entry's labels are exported without images. |

## Limits

- Frame `N` is the `N`-th decoded frame of the video. This matches the
  annotation tool for constant frame rate videos; variable frame rate videos
  have not been checked.
- The original video is downloaded into memory before its frames are
  extracted, as in the UPD export.

## For developers

### Code

The plugin system loads `backends/sync` in the sync service and calls
`IdahVideo::Sync.init` (`../sync.rb`), which registers each exporter for the
`idah-video` modality.

| Path | Role |
| --- | --- |
| `coco/` | `Coco::Exporter` and its writer. See the [COCO README](coco/README.md). |
| `yolo/` | `Yolo::Exporter`. See the [YOLO README](yolo/README.md). |
| `segmentation/` | `Segmentation::Exporter`. See the [Mask Segmentation README](segmentation/README.md). |
| `helpers/base_exporter.rb` | What every exporter does: goes through the datasets, checks their modality, applies the entries filter, writes the report. |
| `helpers/video_entry.rb` | Reads one entry: its video's name and size, its shapes frame by frame in pixels, its tags; extracts its frames. |
| `helpers/category_index.rb` | Builds a dataset's categories from its labeling configuration. |
| `helpers/interpolator.rb`, `helpers/polygon_morph.rb` | Frames between keyframes: ports of the frontend's `utils/interpolation.ts` and of flubber 0.4.2. |
| `helpers/geometry.rb` | Pixels, rotation, clamping, box and area. |
| `helpers/canvas.rb` | A class mask being painted: polygon fill. |
| `helpers/png.rb` | Writes palette PNGs, with Ruby's Zlib only. |
| `helpers/frame_extractor.rb` | Extracts frames with ffmpeg, in one pass per video. |
| `helpers/names.rb` | File and folder names, unique in the export. |
| `helpers/report.rb` | `export_report.json`. |
| `helpers/keys.rb` | Reads API data whatever its key type. |

The namespace is `IdahVideo::Export` (singular): a nested `Exports` would
shadow the sync service's own `::Exports` inside the plugin.

### Adding a format

1. Add a folder next to `coco/` and `yolo/` with an exporter that subclasses
   `Helpers::BaseExporter`, gives a `name` and a `description`, and implements
   `export_dataset(dataset, filter)`. To add options to the export dialog,
   override `options` with a `Verse::Schema` (see `yolo/exporter.rb`, and
   "Exporter options" in `guide/service-sync.md` at the repository root);
   the sync service validates them and passes them in `context.options`.
2. Read each entry with `Helpers::VideoEntry`: `load`, then `shapes` (frame
   to shapes) and `write_images`.
3. Register it in `IdahVideo::Sync.init`, and add a README next to it, linked
   from the table above.

### Tests

```bash
cd plugins/idah-video/backends
bundle exec rspec
```

The specs use a fake export context (`spec_data/fake_export_context.rb`) in
place of the sync service. Frame extraction specs need `ffmpeg`.

The interpolation must match the frontend exactly. Its specs check
`spec_data/interpolation_parity.json`, which the frontend test
`frontend/src/lib/utils/interpolation.parity.test.ts` generates from the real
code. After changing the interpolation or the flubber version, regenerate it
from `plugins/idah-video/frontend`, then rerun the specs:

```bash
npx vitest run -u src/lib/utils/interpolation.parity.test.ts
```

### Runtime

Frame images need ffmpeg in the sync service. In production, sync runs the
`media` image, which has it (`deploy/compose/compose.yml`); the development
image has it for every service.
