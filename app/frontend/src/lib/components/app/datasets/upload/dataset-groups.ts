import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

// One dataset to create from an upload selection.
export interface DatasetGroup {
  key: string; // unique within a selection; names may repeat (e.g. two "x" sub-folders)
  name: string;
  files: PickedFile[];
  isZip: boolean; // a single zip archive, unpacked server-side
}

const ZIP = /\.zip$/i;

const zipGroup = (p: PickedFile): DatasetGroup => ({
  key: p.path,
  name: p.path.split("/").pop()!.replace(ZIP, ""),
  files: [p],
  isZip: true,
});

// Maps a folder/zip selection to datasets, looking one level down only:
// - a zip, picked on its own or directly inside a picked folder, is one dataset named
//   after it (its contents are only known server-side); a zip deeper inside a
//   sub-folder is just part of that sub-folder's dataset
// - a folder holding only files is one dataset, named after it
// - a folder holding sub-folders gives one dataset per sub-folder (deeper levels
//   flattened into it), plus one named after the folder for its own loose files
// Loose files outside any folder are not accepted here (Add Entry takes them).
export function groupIntoDatasets(picked: PickedFile[]): { groups: DatasetGroup[] } {
  const zips: DatasetGroup[] = [];
  const folders = new Map<string, PickedFile[]>(); // top-level folder -> its files

  for (const p of picked) {
    const slash = p.path.indexOf("/");
    if (slash === -1) {
      if (ZIP.test(p.path)) zips.push(zipGroup(p));
      continue; // a loose media file is left out
    }
    const folder = p.path.slice(0, slash);
    folders.set(folder, [...(folders.get(folder) ?? []), p]);
  }

  const groups: DatasetGroup[] = [];
  for (const [folder, files] of folders) {
    const subFolders = new Map<string, PickedFile[]>();
    const own: PickedFile[] = [];
    const ownZips: DatasetGroup[] = [];

    for (const p of files) {
      const rest = p.path.slice(folder.length + 1);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        if (ZIP.test(rest)) ownZips.push(zipGroup(p));
        else own.push(p);
      } else {
        const sub = rest.slice(0, slash);
        subFolders.set(sub, [...(subFolders.get(sub) ?? []), p]);
      }
    }

    if (subFolders.size === 0) {
      if (own.length > 0) groups.push({ key: `${folder}/`, name: folder, files: own, isZip: false });
    } else {
      for (const [sub, subFiles] of subFolders) {
        groups.push({ key: `${folder}/${sub}/`, name: sub, files: subFiles, isZip: false });
      }
      if (own.length > 0) groups.push({ key: `${folder}/*`, name: folder, files: own, isZip: false });
    }
    groups.push(...ownZips);
  }

  return { groups: [...groups, ...zips] };
}

// What was picked, for the selection list: one item per top-level folder or zip (loose
// files are left out). How it splits into datasets is only known after upload, when the
// server has accepted or skipped each file.
export interface PickedItem {
  key: string;
  name: string;
  isZip: boolean;
  files: PickedFile[];
}

export function pickedItems(picked: PickedFile[]): PickedItem[] {
  const items = new Map<string, PickedItem>();
  for (const p of picked) {
    const slash = p.path.indexOf("/");
    if (slash === -1) {
      if (ZIP.test(p.path)) items.set(p.path, { key: p.path, name: p.path, isZip: true, files: [p] });
      continue;
    }
    const folder = p.path.slice(0, slash);
    const item = items.get(`${folder}/`) ?? { key: `${folder}/`, name: folder, isZip: false, files: [] };
    item.files.push(p);
    items.set(item.key, item);
  }
  return [...items.values()];
}
