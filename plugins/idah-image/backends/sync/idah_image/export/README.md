# Image exports

The image plugin adds export formats for `idah-image` datasets to the sync
service. They appear in the export dialog next to the platform's own
Universal Portable Dataset (UPD) export.

| Format | Writes | Keeps | Details |
| --- | --- | --- | --- |
| **COCO (Image)** | One COCO instances file per dataset: boxes, polygons, circles and ellipses as outlines, masks as RLE | Rotation, properties, image tags | [COCO README](coco/README.md) |
| **YOLO (Image)** | One Ultralytics YOLO dataset per dataset: boxes, outlines or rotated boxes (Task option), with an optional validation share | Classes and shapes only | [YOLO README](yolo/README.md) |
| **Mask Segmentation (Image)** | One class mask PNG per image: every shape painted with its class, filled or as outlines (Shapes option), lines 1 pixel wide | Classes and their colours only | [Mask Segmentation README](segmentation/README.md) |

Pick COCO to keep everything IDAH knows about the annotations, or to keep
masks pixel for pixel. Pick YOLO to train a detector, a segmentation model or
an oriented-box model right away. Pick Mask Segmentation to train a semantic
segmentation model, where every pixel gets a class.

This page covers what the formats share: which shapes are exported, how they
are placed, how files are named, and the export report. Each format's README
covers its own files.

## Export options

| Option | Effect |
| --- | --- |
| Include medias: No medias (`none`) | Labels only, for when the images are already at hand. |
| Include medias: Original medias (`original`) | Labels, plus each exported image's original file, copied unchanged with its own format and extension. |
| Include medias: All medias (`all`) | Same as original. Thumbnails and resized copies have no place in a dataset. |
| Completed Entries Only | On by default: only completed entries are exported. Switch it off to export every entry. |

A format can add options of its own, shown in the dialog when it is selected;
COCO (Image) adds how boxes are written (polygons, or rectangles), YOLO
(Image) adds a task and a validation share, and Mask Segmentation (Image) adds
whether shapes are filled or outlined (see their READMEs).

A selection can hold several datasets, but only `idah-image` ones: an export
that includes a dataset of another modality fails.

## What is exported

### One output per dataset

Categories are set up per dataset in IDAH, so each dataset is exported on its
own: a COCO file, or a YOLO dataset, with its own categories and image
folder. Numbering (category ids, YOLO classes, image ids) restarts in each.
To combine datasets, match categories by name, not by number.

### Categories

A dataset's categories are the values of its bounding-box, polygon, circle,
ellipse and mask labeling configurations, in that order. Each is named by its
IDAH id, such as `vehicles/car`: labels are not used because they repeat
across a category tree and can be blank, while ids are unique. A category used
by an annotation but missing from the configuration is added at the end.

### Shapes

| IDAH shape | Exported as |
| --- | --- |
| Bounding box | Its 4 corners, rotated as drawn. |
| Polygon | Its points. |
| Circle | A 64-point polygon; in Mask Segmentation, filled, or its outline 1 pixel thick, drawn as a pixel circle. |
| Ellipse | A 64-point polygon, rotated as drawn; in Mask Segmentation, filled, or its outline as for a circle. |
| Mask | Its pixels: COCO RLE in COCO; in YOLO, the outline of each separate piece, holes joined by zero-width cuts; in Mask Segmentation, painted pixel for pixel. |
| Line | Mask Segmentation only: painted 1 pixel wide. COCO and YOLO hold no open line and count it as `unsupported_shape_type:idah-image:line`. |

Shapes are stored in IDAH as fractions of the image. The export places them in
pixels of the original image:

- A rotated box or ellipse is turned around its centre, clockwise, as the
  annotation tool draws it.
- A circle's radius is a fraction of the image's shorter side; an ellipse's
  radii are fractions of its width and height.
- Shapes are clamped to the image. A shape that lies outside the image, with
  no area once clamped, is skipped.
- A polygon with fewer than 3 points is skipped: tools read it as a box.
- A mask is read from the tiles the annotation tool stores (128 × 128 pixels,
  run-length encoded) and cut to the image. An empty mask is skipped.

### Names

Folders and files are named after the dataset and the entry (without its
extension). Characters other than letters, digits, `.`, `-` and `_` become
`_`. An entry with no name uses its uploaded file's name. When two datasets,
or two entries of a dataset, share a name, later ones get a suffix: `street`,
`street_2`.

An image with nothing to export, and a dataset with nothing to export, are
left out and counted in the report.

### Image files

With medias, each exported image's original upload is copied as it is: a
`.png` stays a `.png`. Its extension comes from the uploaded file's name, then
the entry's name, else `.jpg`. An image that cannot be read keeps its labels
and gets no file; the report says so in `warnings`.

## export_report.json

Every export has an `export_report.json` at the root of the zip, for the whole
export, so nothing is left out without a trace.

```json
{
  "datasets": 1,
  "images": 120,
  "annotations": 1834,
  "image_files": 120,
  "skipped": {
    "unsupported_shape_type:idah-image:line": 4,
    "images_without_annotations": 3
  },
  "warnings": []
}
```

| Field | Meaning |
| --- | --- |
| `datasets` | Datasets exported: COCO files or YOLO datasets. |
| `images` | Images exported: COCO images, or YOLO label files. |
| `annotations` | Shapes exported: COCO annotations, or YOLO label lines (a mask in several pieces gives several lines). |
| `image_files` | Image files written. `0` without medias; lower than `images` when some could not be read (see `warnings`). |
| `skipped` | Data left out, counted by reason (below). |
| `warnings` | Problems with a whole entry, one message each (below). |

### skipped

| Reason | Meaning |
| --- | --- |
| `deleted` | A deleted annotation. |
| `no_category` | A shape without a category. |
| `zero_area` | A shape that lies outside the image, an empty mask, or (YOLO) a mask too thin to outline. |
| `too_few_points` | A polygon with fewer than 3 points, or (Mask Segmentation) a line with fewer than 2. |
| `small_mask_pieces` | YOLO only: a separate piece of a mask covering fewer than 20 pixels (see the YOLO README). |
| `unsupported_shape_type:<type>` | An annotation the format cannot hold: lines (`idah-image:line`) in COCO and YOLO, image tags (`entry:root`) in YOLO and Mask Segmentation; COCO keeps image tags. |
| `too_many_classes` | Mask Segmentation only: a shape of a dataset's 256th class or later, as a mask PNG holds 255 classes besides background. |
| `images_without_annotations` | An entry with nothing to export. |
| `datasets_without_annotations` | A dataset with nothing to export; it gets no file or folder. |

### warnings

| Message | Meaning |
| --- | --- |
| ``Entry `<name>` (<id>) skipped: image width and height are unknown.`` | The image's metadata is missing, so its shapes cannot be placed in pixels. Nothing of the entry is exported. |
| ``Entry `<name>` (<id>): no image, the original could not be read (<error>).`` | The original image could not be downloaded. The entry's labels are exported without the image. |
| ``Dataset `<name>` (<id>): no image fell in val; val points at train.`` | YOLO only, with a validation share: see the YOLO README. |
| ``Entry `<name>` (<id>): a `<category>` mask outline has N points; …`` | YOLO segment only: a mask outline longer than 10,000 points, which Ultralytics may run out of memory loading. The mask is exported; see Masks in the YOLO README. |

## For developers

### Code

The plugin system loads `backends/sync` in the sync service and calls
`IdahImage::Sync.init` (`../sync.rb`), which registers each exporter for the
`idah-image` modality.

| Path | Role |
| --- | --- |
| `coco/` | `Coco::Exporter` and its writer. See the [COCO README](coco/README.md). |
| `yolo/` | `Yolo::Exporter`. See the [YOLO README](yolo/README.md). |
| `segmentation/` | `Segmentation::Exporter`. See the [Mask Segmentation README](segmentation/README.md). |
| `helpers/base_exporter.rb` | What every exporter does: goes through the datasets, checks their modality, applies the entries filter, writes the report. |
| `helpers/image_entry.rb` | Reads one entry: its image's name, size and file, its shapes in pixels, its tags; copies its original. |
| `helpers/mask.rb` | Decodes a mask's tiles; gives its area, box, COCO RLE and outlines. |
| `helpers/category_index.rb` | Builds a dataset's categories from its labeling configuration. |
| `helpers/geometry.rb` | Pixels, rotation, ellipses, clamping, box, area and rotated rectangles. |
| `helpers/canvas.rb` | A class mask being painted: polygon fill, line stroke and mask pixels. |
| `helpers/png.rb` | Writes palette PNGs, with Ruby's Zlib only. |
| `helpers/names.rb` | File and folder names, unique in the export. |
| `helpers/report.rb` | `export_report.json`. |
| `helpers/keys.rb` | Reads API data whatever its key type. |

The namespace is `IdahImage::Export` (singular): a nested `Exports` would
shadow the sync service's own `::Exports` inside the plugin. The helpers are
the image plugin's own; the video plugin has its own copy, so each plugin can
change without the other.

### Adding a format

1. Add a folder next to `coco/` and `yolo/` with an exporter that subclasses
   `Helpers::BaseExporter`, gives a `name` and a `description`, and implements
   `export_dataset(dataset, filter)`. To add options to the export dialog,
   override `options` with a `Verse::Schema` (see `yolo/exporter.rb`, and
   "Exporter options" in `guide/service-sync.md` at the repository root);
   the sync service validates them and passes them in `context.options`.
2. Read each entry with `Helpers::ImageEntry`: `load`, then `shapes` and
   `write_image`.
3. Register it in `IdahImage::Sync.init`, and add a README next to it, linked
   from the table above.

### Tests

```bash
cd plugins/idah-image/backends
bundle exec rspec
```

The specs use a fake export context (`spec_data/fake_export_context.rb`) in
place of the sync service, and build masks with `spec_data/mask_tiles.rb`, a
Ruby copy of the frontend's mask encoder.
