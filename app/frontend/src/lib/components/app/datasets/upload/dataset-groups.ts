import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

// What was picked, for the selection list: one item per picked folder or zip, plus one
// for all loose files.
export interface PickedItem {
  key: string; // the folder path ("clip/"), the zip path, or LOOSE_KEY
  name: string;
  isZip: boolean;
  isLoose: boolean; // files picked outside any folder or zip, named by the user
  files: PickedFile[];
  subFolders: string[]; // direct sub-folders, sorted (none for a zip: its contents are only known server-side)
  subFolderFiles: Record<string, number>; // how many files each sub-folder holds, deeper levels included
  topFiles: number; // files directly in it
}

// One dataset to create from an upload selection.
export interface DatasetGroup {
  key: string; // unique within a selection
  name: string;
  files: PickedFile[];
  isZip: boolean; // a single zip archive, unpacked server-side
  root: string; // path prefix of the dataset's folder; entries are named by their path below it
}

// The files directly in a folder split per sub-folder: not uploaded, only reported.
export interface LeftOut {
  name: string; // the folder's
  files: PickedFile[];
}

export interface SplitOptions {
  split?: ReadonlySet<string>; // keys of the picked folders to split into one dataset per sub-folder
  looseName?: string; // the name of the dataset holding the loose files
}

export const LOOSE_KEY = "\0loose"; // no picked path can be this
export const DEFAULT_LOOSE_NAME = ""; // the user names it before creating

const ZIP = /\.zip$/i;
const naturally = new Intl.Collator(undefined, { numeric: true }).compare; // clip_2 before clip_10

// Sub-folders (with their file counts) and the number of files directly at the top, from paths below it.
function shape(paths: string[]): Pick<PickedItem, "subFolders" | "subFolderFiles" | "topFiles"> {
  const subFolderFiles: Record<string, number> = {};
  let topFiles = 0;
  for (const path of paths) {
    const slash = path.indexOf("/");
    if (slash === -1) topFiles++;
    else subFolderFiles[path.slice(0, slash)] = (subFolderFiles[path.slice(0, slash)] ?? 0) + 1;
  }
  return { subFolders: Object.keys(subFolderFiles).sort(naturally), subFolderFiles, topFiles };
}

// One item per picked folder or zip, and one for all loose files, in selection order.
export function pickedItems(picked: PickedFile[], { looseName = DEFAULT_LOOSE_NAME }: SplitOptions = {}): PickedItem[] {
  const items = new Map<string, PickedItem>();
  type Identity = Omit<PickedItem, "files" | "subFolders" | "subFolderFiles" | "topFiles">;
  const add = (key: string, init: () => Identity, p: PickedFile) => {
    const item = items.get(key) ?? { ...init(), files: [], subFolders: [], subFolderFiles: {}, topFiles: 0 };
    item.files.push(p);
    items.set(key, item);
  };

  for (const p of picked) {
    const slash = p.path.indexOf("/");
    if (slash !== -1) {
      const key = `${p.path.slice(0, slash)}/`;
      add(key, () => ({ key, name: key.slice(0, -1), isZip: false, isLoose: false }), p);
    } else if (ZIP.test(p.path)) {
      add(p.path, () => ({ key: p.path, name: p.path.replace(ZIP, ""), isZip: true, isLoose: false }), p);
    } else {
      add(LOOSE_KEY, () => ({ key: LOOSE_KEY, name: looseName.trim(), isZip: false, isLoose: true }), p);
    }
  }

  for (const item of items.values()) {
    if (!item.isZip) Object.assign(item, shape(item.files.map((p) => p.path.slice(relativeTo(item).length))));
  }
  return [...items.values()];
}

function relativeTo(item: PickedItem): string {
  return item.isZip || item.isLoose ? "" : item.key;
}

// Each picked folder or zip is one dataset, named after it, in selection order; its entries
// are named by their path in it ("cam_a/0001.jpg"). Loose files go together into one
// dataset named by the user. Split per sub-folder, a folder gives one dataset per direct
// sub-folder instead, named after it, with entries named by their path in that sub-folder;
// the files directly at its top are left out (usually a README or a cover, not data).
export function groupIntoDatasets(
  picked: PickedFile[],
  options: SplitOptions = {},
): { groups: DatasetGroup[]; leftOut: LeftOut[] } {
  const { split = new Set() } = options;
  const groups: DatasetGroup[] = [];
  const leftOut: LeftOut[] = [];

  for (const item of pickedItems(picked, options)) {
    const { key, name, isZip, files, subFolders } = item;
    const root = relativeTo(item);
    if (!split.has(key) || subFolders.length === 0) {
      groups.push({ key, name, files, isZip, root });
    } else {
      const top = files.filter((p) => !p.path.slice(root.length).includes("/"));
      if (top.length > 0) leftOut.push({ name, files: top });
      for (const sub of subFolders) {
        const subRoot = `${root}${sub}/`;
        groups.push({
          key: subRoot,
          name: sub,
          files: files.filter((p) => p.path.startsWith(subRoot)),
          isZip,
          root: subRoot,
        });
      }
    }
  }
  return { groups, leftOut };
}
