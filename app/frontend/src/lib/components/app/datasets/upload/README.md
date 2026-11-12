# Media upload

How picked files, folders and zips become media, entries and datasets. Two flows share this code:

| Flow                          | Where                                                                 | What a pick becomes                                                                           |
| ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **New Dataset → From upload** | `overlays/DatasetFormModal.svelte` (form: `forms/DatasetForm.svelte`) | One new dataset per folder or zip, one per sub-folder when split, and one for the loose files |
| **Add Entry**                 | `entries/overlays/_UploadEntryFormModal.svelte`                       | Entries in the current dataset                                                                |

## The pipeline

```
pick / drop ──► PickedFile[] ──► groups (datasets) ──► rows ──► UploadItem[] ──► media ──► entries
 file-upload     MediaPicker      dataset-groups.ts     upload-rows.ts   upload-pipeline.ts
```

1. **Pick.** `forms/fields/upload/file-upload.svelte` reads the file inputs and drops into `PickedFile { file, path }`.
   - `path` is relative to what was picked: `clip_a/0001.jpg` for a file in a folder, `0001.jpg` for a loose file.
   - Dropped folders are walked recursively (`collectDroppedFiles`).
   - OS files (`.DS_Store`, `__MACOSX/`, `._*`) are dropped here, with the same rules as the media service.
2. **Collect.** `MediaPicker.svelte` appends every new pick to `picked` (`mergePickedFiles`), skipping files already there.
   - A file is the same when its path, size and modified time match.
   - In `"datasets"` mode the picker also owns `split` (the folders split per sub-folder) and `looseName`.
3. **Group** (New Dataset only). `groupIntoDatasets` in `dataset-groups.ts` decides the datasets. See the rules below.
4. **Rows.** `upload-rows.ts` turns a dataset's files into rows: a zip is one `"file"` row, and a folder is one `"folder"` row.
   - Add Entry builds its rows with `buildEntryRows`: one row per loose file or zip, and one per picked folder.
   - The rows are both the upload's work list (`rowItems`) and its summary (`rowView`).
5. **Upload.** `uploadAll` in `upload-pipeline.ts` uploads the items one at a time.
   - Each file goes to the media service, then gets one entry per media it produced.
6. **Summary.** `UploadMediaItem.svelte` renders each row, with what it created, skipped and failed behind toggles.
   - `showUploadSummaryToast` sums the whole upload in one toast.

## Grouping rules (`dataset-groups.ts`)

`pickedItems` makes one item per thing the user picked, in selection order. The picker lists these items, and `groupIntoDatasets` turns each into datasets:

| Picked                          | Item key          | Datasets                                                                                                  |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| A folder (`clip/…`)             | `clip/`           | One, named `clip`                                                                                         |
| The same folder, split          | `clip/`           | One per direct sub-folder, named after it. Files directly in `clip/` are ignored and reported (`leftOut`) |
| A zip (`batch.zip`)             | `batch.zip`       | One, named `batch`. Zips can't be split: their contents are only known server side                        |
| A second zip with the same name | `batch.zip\0` + n | Its own dataset, also named `batch`                                                                       |
| Loose files                     | `LOOSE_KEY`       | One, named by the user (`looseName`, empty until typed)                                                   |

- Item keys are unique within a selection. They key the picker's list, `split` and the expanded rows.
- A zip inside a folder belongs to that folder's dataset. Its media are named after where it sat (`zipPrefix`).
- Folders are matched by their top-level name. Two picked folders with the same name merge into one dataset.

## Entry names

An entry is named by its path inside its dataset's folder (`entryName` in `upload-item.types.ts`). Same-named files in different sub-folders therefore stay apart.

| Source                                             | Example path                    | Entry name              |
| -------------------------------------------------- | ------------------------------- | ----------------------- |
| File in a folder dataset `clip`                    | `clip/cam1/0001.jpg`            | `cam1/0001.jpg`         |
| File in a split dataset `cam1`                     | `clip/cam1/0001.jpg`            | `0001.jpg`              |
| Loose file                                         | `0001.jpg`                      | `0001.jpg`              |
| Media in a zip                                     | `frames/0001.jpg` in the zip    | `frames/0001.jpg`       |
| Media in a zip that wraps everything in one folder | `batch/0001.jpg`                | `0001.jpg`              |
| Media in a zip inside a folder                     | `extra/frames.zip` → `0001.jpg` | `extra/frames/0001.jpg` |

The media service names a zip's media and drops its single wrapping folder (`wrapping_folder` in `app/media/app/service/medias/service.rb`). The frontend adds the zip's own location.

## Upload behaviour (`upload-pipeline.ts`)

- **Lazy datasets.** New Dataset passes `getDatasetId`, which creates the dataset on first call. It is called only once a file produced media, so an empty or unsupported folder never leaves an empty dataset behind. `once()` makes every file of a run share that one creation, and all the run's datasets share one fetched label config.
- **Retries.** A failed file is retried up to `MAX_RETRIES` times with exponential backoff and jitter.
  - It resumes where it stopped: media already uploaded (`uploadedMedias`) aren't sent again, and entries already created (`createdEntryCount`) aren't created again.
- **Failures stay local.** A failing file never stops the others, with one exception: when its dataset can't be created (`DatasetCreationError`), the run's remaining files are marked "not uploaded".
- **Server reports.** The media service returns `meta.skipped` (unsupported or too large) and `meta.errored` (failed to process) for a zip's files. They end up in the item's `skippedMedias` and `errorMedias`, shown under its row.
- **Sequential.** Files go one at a time, and every file is a rendered row. See the `ponytail:` note in `uploadAll` before handling batches of thousands.
- **Leaving the page.** The upload runs in the page, so leaving stops it halfway. While it runs, `guardLeavingDuringUpload` (`upload-leave-guard.svelte.ts`) makes the browser ask before closing or reloading the tab, and refuses in-app navigation such as Back with a toast. Both modals also say so up front (`UploadKeepOpenNote.svelte`), since the browser prompt can only use its own generic text.

## Files

| File                                                                                            | Role                                                                                          |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `forms/fields/upload/file-upload.svelte`                                                        | Pick buttons and drop zone                                                                    |
| `forms/fields/upload/file-upload.utils.ts`                                                      | `PickedFile`, drop walking, OS-file filter, merge with dedupe                                 |
| `MediaPicker.svelte`                                                                            | The selection list for both flows; the split switch and loose-files name in `"datasets"` mode |
| `PreviewUploadMediaItem.svelte`                                                                 | One row of the selection list                                                                 |
| `dataset-groups.ts`                                                                             | Picked files → picker items → datasets                                                        |
| `upload-item.types.ts`                                                                          | `UploadItem` (one file's upload state), `entryName`                                           |
| `upload-rows.ts`                                                                                | Rows of items: build them, list their items, sum a folder into one view                       |
| `upload-pipeline.ts`                                                                            | Upload, retry, entry creation, summary toast                                                  |
| `upload-item-utils.ts`                                                                          | A row's status line                                                                           |
| `UploadMediaItem.svelte`, `UploadItemCollapsibleSection.svelte`, `_UploadItemStatusIcon.svelte` | The summary rows                                                                              |
| `upload-summary.ts`                                                                             | The modal footer text ("3 items to upload")                                                   |
| `upload-leave-guard.svelte.ts`                                                                  | Asks before leaving the page while an upload runs                                             |
| `UploadKeepOpenNote.svelte`                                                                     | The "keep this tab open" line shown while an upload runs                                      |

`dataset-groups`, `upload-rows`, `upload-pipeline`, `upload-summary` and `file-upload.utils` have a `*.test.ts` beside them. Run them inside the frontend container (`pnpm exec vitest run src/lib/components/app/datasets/upload`).
