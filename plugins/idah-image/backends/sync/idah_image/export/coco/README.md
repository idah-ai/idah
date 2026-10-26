# COCO (Image) export

Exports `idah-image` datasets as [COCO](https://cocodataset.org/#format-data)
instances files, one per dataset. Every entry with a shape or an image tag
becomes a COCO image, and every shape on it becomes an annotation.

The standard COCO fields are complete on their own, so any COCO tool
(`pycocotools`, detection frameworks) reads the export. IDAH data with no COCO
field goes in `attributes` and in IDAH ids on images, which COCO tools ignore.

The export appears as **COCO (Image)** in the export dialog for image
datasets. What it shares with the other image exports (export options, how
shapes are placed, names, and the export report) is described in the
[image exports README](../README.md).

## Options

Beside "Include medias" and "Completed Entries Only", the export dialog shows
one option when COCO (Image) is selected:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| Boxes (`boxes`) | Polygons (`polygon`), Rectangles (`rectangle`) | Polygons | How boxes are written; see [Boxes](#boxes). |

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
  <dataset>/<entry>.<ext>
export_report.json               what was exported and what was left out, for the whole export
```

Each dataset is a complete COCO file of its own, paired with its own image
folder, the way COCO itself ships `instances_train2017.json` with
`train2017/`. Every id (categories, images, annotations) counts from 1 in each
file. To combine files, match categories by `name`, not by `id`.

## instances_<dataset>.json

```jsonc
{
  "info": { "description": "IDAH export", "version": "1.0", "year": 2026,
            "contributor": "IDAH", "url": "", "date_created": "2026-10-15T10:00:00Z" },
  "licenses": [],
  "categories": [
    { "id": 1, "name": "vehicles/car", "supercategory": "vehicles" },
    { "id": 2, "name": "water", "supercategory": "" }
  ],
  "images": [{
    "id": 1, "file_name": "street.png", "width": 1920, "height": 1080,
    "idah_entry_id": "019e…", "idah_dataset_id": "019d…",
    "attributes": { "category": "rain", "visibility": "low" }
  }],
  "annotations": [
    {
      "id": 1, "image_id": 1, "category_id": 1, "iscrowd": 0,
      "segmentation": [[812.4, 300.1, 1032.4, 300.1, 1032.4, 440.6, 812.4, 440.6]],
      "bbox": [812.4, 300.1, 220.0, 140.5],
      "area": 30910.0,
      "attributes": { "occlusion": "Partial", "idah_id": "019f…", "rotation": 0.0 }
    },
    {
      "id": 2, "image_id": 1, "category_id": 2, "iscrowd": 0,
      "segmentation": { "size": [1080, 1920], "counts": "P`Z6<\\Q12X^O…" },
      "bbox": [192, 0, 340, 96],
      "area": 21408,
      "attributes": { "idah_id": "019f…" }
    }
  ]
}
```

Polygon coordinates are in pixels of the original image, clamped to it and
rounded to 2 decimals; mask values are whole pixels.

### categories

The dataset's categories (see [Categories](../README.md#categories)).

- `name` is the IDAH category id, such as `vehicles/car`.
- `supercategory` is the parent path (`vehicles`), or `""` at the top.

Image tag categories are not listed here (see below).

### images

One per exported entry.

| Field | Meaning |
| --- | --- |
| `file_name` | Relative to the dataset's image folder, `images/<dataset>/`: the entry's name with the original file's extension. |
| `width`, `height` | The original image's size in pixels. |
| `idah_entry_id`, `idah_dataset_id` | Where the image comes from in IDAH. |
| `attributes` | The image tag (`entry:root`): its `category` and properties. Absent when the entry has none. |

An entry is exported when it has at least one shape, or an image tag.

### annotations

One per shape.

| Field | Meaning |
| --- | --- |
| `segmentation` | Boxes, polygons, circles and ellipses: the outline as one polygon `[[x1, y1, x2, y2, …]]`, at least 3 points; `[]` for an upright box with Boxes: Rectangles (see [Boxes](#boxes)). Masks: compressed RLE `{"size": [height, width], "counts": "…"}` (below). |
| `bbox` | The axis-aligned box around the shape, `[x, y, width, height]`. |
| `area` | The outline's area, or the mask's number of pixels; always above 0. |
| `category_id` | The category in `categories`. |
| `iscrowd` | Always `0`: each annotation is one object, masks included. |
| `attributes.rotation` | Boxes and ellipses only: the rotation in degrees, clockwise, from 0 to 360. It is already applied to `segmentation` and `bbox`; it is there to rebuild the rotated shape. |
| `attributes.idah_id` | The IDAH annotation the shape comes from. |
| `attributes.*` | The annotation's IDAH properties, as stored. |

### Masks

A mask keeps its exact pixels, holes and separate pieces included, as COCO's
compressed RLE, the form `pycocotools` writes: run lengths over the whole
image, column by column, starting with a run of unset pixels, packed into the
`counts` string. It is about a third of the size of the same runs written as a
list of numbers. `pycocotools` reads it with `annToMask` (or
`pycocotools.mask.decode`), with `iscrowd: 0` as well, and so do the tools
built on it (Detectron2, MMDetection, FiftyOne). A mask's `bbox` and `area`
count its pixels.

To get the run lengths themselves, decode the mask and re-encode it, or read
the string as `rleToString` in pycocotools' `maskApi.c` writes it.

Some tools only read polygon `segmentation`. To get polygons, convert the
masks (for example with `pycocotools.mask.decode` and OpenCV's
`findContours`), or use the YOLO segment export, which outlines them.

## Reading the export

```python
from pycocotools.coco import COCO

coco = COCO("annotations/instances_<dataset>.json")     # images in images/<dataset>/
image = coco.loadImgs(coco.getImgIds())[0]
annotations = coco.loadAnns(coco.getAnnIds(imgIds=image["id"]))
mask = coco.annToMask(annotations[0])                   # polygons and RLE alike
```

## Viewing in FiftyOne

[FiftyOne](https://docs.voxel51.com/) imports each dataset's file with its
image folder. It needs `pip install fiftyone pycocotools`.

```python
import fiftyone as fo

dataset = fo.Dataset.from_dir(
    dataset_type=fo.types.COCODetectionDataset,
    data_path="images/<dataset>",
    labels_path="annotations/instances_<dataset>.json",
    label_types=["detections", "segmentations"],
    extra_attrs=True,  # attributes become label fields
)

# The label attributes (rotation, idah_id, properties) are imported as
# undeclared fields, which the app hides until they are declared.
dataset.add_dynamic_sample_fields()

session = fo.launch_app(dataset)
```

## Code

| File | Role |
| --- | --- |
| `exporter.rb` | `IdahImage::Export::Coco::Exporter`, registered for `idah-image` in `sync.rb`. |
| `writer.rb` | Writes one `instances_<dataset>.json`, streaming images and annotations through temporary files. |

Everything else (reading entries, masks, geometry, image files, the report)
is in `../helpers/`, shared with the other image exports; see the
[image exports README](../README.md#for-developers).
