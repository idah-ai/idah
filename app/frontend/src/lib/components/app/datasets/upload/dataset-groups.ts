import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

// One dataset to create from an upload selection.
export interface DatasetGroup {
  key: string; // unique within a selection; names may repeat (e.g. two "x" sub-folders)
  name: string;
  files: PickedFile[];
}

const ZIP = /\.zip$/i;

// Maps a folder/zip selection to datasets, looking one level down only:
// - a zip is one dataset, named after it (its contents are only known server-side)
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
      if (ZIP.test(p.path)) zips.push({ key: p.path, name: p.path.replace(ZIP, ""), files: [p] });
      continue; // a loose media file is left out
    }
    const folder = p.path.slice(0, slash);
    folders.set(folder, [...(folders.get(folder) ?? []), p]);
  }

  const groups: DatasetGroup[] = [];
  for (const [folder, files] of folders) {
    const subFolders = new Map<string, PickedFile[]>();
    const own: PickedFile[] = [];

    for (const p of files) {
      const rest = p.path.slice(folder.length + 1);
      const slash = rest.indexOf("/");
      if (slash === -1) own.push(p);
      else {
        const sub = rest.slice(0, slash);
        subFolders.set(sub, [...(subFolders.get(sub) ?? []), p]);
      }
    }

    if (subFolders.size === 0) {
      groups.push({ key: `${folder}/`, name: folder, files: own });
      continue;
    }
    for (const [sub, subFiles] of subFolders) groups.push({ key: `${folder}/${sub}/`, name: sub, files: subFiles });
    if (own.length > 0) groups.push({ key: `${folder}/*`, name: folder, files: own });
  }

  return { groups: [...groups, ...zips] };
}
