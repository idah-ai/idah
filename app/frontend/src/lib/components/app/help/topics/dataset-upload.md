# Creating datasets from an upload

Pick or drop folders, zip files and single files. Each pick is added to the list, so you can pick several times before creating.

## What becomes a dataset

- **A folder** becomes one dataset, named after the folder. Everything inside it is included, sub-folders too.
- **A zip file** becomes one dataset, named after the zip.
- **Single files** picked outside any folder or zip go together into one dataset. Give it a name in the list.

Each file becomes an entry named by its path inside the folder or zip, so files with the same name in different sub-folders stay apart.

## Examples

### Example 1: A folder

```example
You pick a folder
drive_01/
  cam_a/
    0001.png
  cam_b/
    0001.png
  cover.png
---
You get **1 dataset** with 3 entries
dataset: drive_01
  cam_a/0001.png
  cam_b/0001.png
  cover.png
```

### Example 2: The same folder, with Per sub-folder on

```example
You pick the same folder, with **Per sub-folder** on
drive_01/
  cam_a/
    0001.png
  cam_b/
    0001.png
  cover.png  # ignored
---
You get **2 datasets**, one per sub-folder
dataset: cam_a
  0001.png
dataset: cam_b
  0001.png
```

> [!NOTE]
> Files directly in the folder, outside any sub-folder (here `cover.png`), are ignored.

### Example 3: A zip file

```example
You pick a zip
batch.zip
  batch/
    0001.png
    night/
      0002.png
---
You get **1 dataset** with 2 entries
dataset: batch
  0001.png
  night/0002.png
```

> [!TIP]
> Zipping a folder puts that folder inside the zip. It's left out of the entry names, so a zipped folder gives the same entries as the folder itself.

### Example 4: Single files

```example
You pick single files, and name the dataset "Extras"
a.png
b.png
---
You get **1 dataset** with 2 entries
dataset: Extras
  a.png
  b.png
```

## Splitting into one dataset per sub-folder

Turn on **Per sub-folder** on a folder to create one dataset for each of its sub-folders instead, named after it.

> [!WARNING]
> A zip is always one dataset. To split one, unzip it and pick the folder.

## What is skipped

Files the selected modality doesn't support are skipped and listed in the summary once the upload finishes.
