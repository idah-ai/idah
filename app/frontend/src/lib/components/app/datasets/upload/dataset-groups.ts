import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

// One dataset to create from an upload selection.
export interface DatasetGroup {
  key: string; // unique within a selection: the folder path ("clip/") or the zip path
  name: string;
  files: PickedFile[];
  isZip: boolean; // a single zip archive, unpacked server-side
  root: string; // path prefix of the dataset's folder; entries are named by their path below it
}

const ZIP = /\.zip$/i;

// Each picked folder or zip is one dataset, named after it, in selection order:
// - a folder takes everything inside it, sub-folders and zips included; its entries
//   are named by their path in it ("cam_a/0001.jpg")
// - a zip's contents are only known server-side, which names its entries by their
//   path in the zip
// Loose files outside any folder are not accepted here (Add Entry takes them).
export function groupIntoDatasets(picked: PickedFile[]): { groups: DatasetGroup[] } {
  const groups = new Map<string, DatasetGroup>();

  for (const p of picked) {
    const slash = p.path.indexOf("/");
    if (slash === -1) {
      if (ZIP.test(p.path)) {
        groups.set(p.path, { key: p.path, name: p.path.replace(ZIP, ""), files: [p], isZip: true, root: "" });
      }
      continue; // a loose media file is left out
    }

    const folder = p.path.slice(0, slash);
    const key = `${folder}/`;
    const group = groups.get(key) ?? { key, name: folder, files: [], isZip: false, root: key };
    group.files.push(p);
    groups.set(key, group);
  }

  return { groups: [...groups.values()] };
}
