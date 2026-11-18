<script lang="ts">
  import {
    ChevronDownIcon,
    ChevronRightIcon,
    DatabaseIcon,
    FileArchiveIcon,
    FileIcon,
    FolderIcon,
    TriangleAlertIcon,
  } from "@lucide/svelte";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";

  import PreviewUploadMediaItem from "./PreviewUploadMediaItem.svelte";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";

  import { DEFAULT_LOOSE_NAME, pickedItems, type PickedItem } from "@/components/app/datasets/upload/dataset-groups";
  import { mergePickedFiles, type PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import { pluralizeUnit } from "@/utils/unit";

  import type { FileUploadPicker } from "@/components/app/forms/fields/upload/file-upload.types";

  // Media selection shared by every upload flow: files/folders/zips can be picked
  // or dropped repeatedly; each pick is appended (deduplicated) to `picked`.
  // - "entries": everything is flattened into one dataset (Add Entry)
  // - "datasets": each folder or zip becomes a new dataset (or one per sub-folder), and the
  //   loose files together one more, named by the user
  interface Props {
    picked: PickedFile[];
    // "datasets" mode: keys of the folders split into one dataset per sub-folder.
    split?: string[];
    // "datasets" mode: the name of the dataset holding the loose files.
    looseName?: string;
    // "datasets" mode: a submit was refused, so a missing name is shown as an error.
    showErrors?: boolean;
    mode?: "entries" | "datasets";
    class?: string;
  }
  let {
    picked = $bindable([]),
    split = $bindable([]),
    looseName = $bindable(DEFAULT_LOOSE_NAME),
    showErrors = false,
    mode = "entries",
    class: className = "py-8",
  }: Props = $props();

  // A browser folder dialog picks one folder at a time, so the texts say how to add more:
  // pick again (each pick is appended) or drop several folders at once.
  const PICKERS: Record<"entries" | "datasets", { pickers: FileUploadPicker[]; dropHint: string }> = {
    entries: {
      pickers: [
        { kind: "files", label: "Select files", description: "Media files or .zip archives, added to this dataset" },
        {
          kind: "folder",
          label: "Select folder",
          description: "Everything in the folder and its sub-folders (pick again to add more)",
        },
      ],
      dropHint: "or drag and drop files and folders, several at once",
    },
    datasets: {
      pickers: [
        { kind: "files", label: "Select files" }, // explained by the form's "How it works" help
        { kind: "folder", label: "Select folder" },
      ],
      dropHint: "or drag and drop files and folders, several at once",
    },
  };

  // Variables
  // "datasets" mode lists each picked folder or zip, and the loose files, with the datasets they create.
  const items = $derived(mode === "datasets" ? pickedItems(picked, { looseName }) : []);

  // Functions
  // Nothing is filtered here (no accepted types): the server decides per file and reports what it skipped.
  function handleFilesSelected(added: PickedFile[]): void {
    picked = mergePickedFiles(picked, added);
  }

  function setSplit(key: string, on: boolean): void {
    split = on ? [...split, key] : split.filter((k) => k !== key);
  }

  const count = (n: number, unit: string) => `${n} ${pluralizeUnit(n, unit)}`;

  // The detail line of a folder/zip: how many datasets it creates (listed on demand, see splitDatasets).
  function datasetDetails(item: PickedItem, splitting: boolean): string {
    if (splitting) {
      return count(item.subFolders.length, "dataset"); // the ignored files follow, in the warning colour
    }
    // a zip's file count is only known once the server unpacks it
    return item.isZip ? "1 dataset" : `1 dataset · ${count(item.files.length, "file")}`;
  }

  // A folder's (or the loose files') entry names, as they will be created; long lists are cut.
  const MAX_LISTED_FILES = 200;
  const naturally = new Intl.Collator(undefined, { numeric: true }).compare; // 2.jpg before 10.jpg
  function entryNames(item: PickedItem): string[] {
    return item.files.map((p) => (item.isLoose ? p.path : p.path.slice(item.key.length))).sort(naturally);
  }

  // A split folder's files: those of one sub-folder (named by their path in it), or those at its top.
  function filesIn(item: PickedItem, subFolder?: string): string[] {
    const root = subFolder === undefined ? item.key : `${item.key}${subFolder}/`;
    return item.files
      .filter((p) => p.path.startsWith(root) && (subFolder !== undefined || !p.path.slice(root.length).includes("/")))
      .map((p) => p.path.slice(root.length))
      .sort(naturally);
  }

  // Keys of the folders (and loose files, and a split folder's lines) whose list is shown.
  let expanded = $state<string[]>([]);
  function toggleExpanded(key: string): void {
    expanded = expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key];
  }

  function clear(): void {
    picked = [];
    split = [];
    expanded = [];
  }

  function remove(files: PickedFile[]): void {
    const removed = new Set(files);
    picked = picked.filter((p) => !removed.has(p));
    const left = new Set(pickedItems(picked).map((item) => item.key));
    split = split.filter((key) => left.has(key)); // picked again later, it starts as one dataset
  }
</script>

<!-- Loose files have no folder or zip to name their dataset after: the user names it. -->
{#snippet looseNameInput()}
  <Input
    bind:value={looseName}
    placeholder="Enter dataset name"
    aria-label="Name of the dataset for the loose files"
    aria-invalid={showErrors && !looseName.trim()}
    class="h-7 px-2 text-sm font-medium"
  />
{/snippet}

<!-- Smaller once something is picked, leaving room for the list. -->
<FileUpload class={picked.length > 0 ? "py-3" : className} {...PICKERS[mode]} onFilesSelected={handleFilesSelected} />

{#snippet clearAll(rows: number)}
  {#if rows > 1}
    <div class="mt-2 flex justify-end">
      <Button variant="link" size="sm" class="text-muted-foreground h-auto p-0 text-xs" onclick={clear}
        >Clear all</Button
      >
    </div>
  {/if}
{/snippet}

<!-- A split folder: the datasets it creates, and its top-level files left out; each opens into its files. -->
{#snippet datasetList(item: PickedItem)}
  <ul class="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
    {#each item.subFolders as name (name)}
      {@render toggleRow(`${item.key}${name}/`, name, count(item.subFolderFiles[name], "file"), filesIn(item, name))}
    {/each}
    {#if item.topFiles > 0}
      <!-- left out: usually a README or a cover, not data -->
      {@render toggleRow(`${item.key}*`, "Ignored, no folder", count(item.topFiles, "file"), filesIn(item), true)}
    {/if}
  </ul>
{/snippet}

<!-- One line of a split folder's list: a dataset (or the ignored files) opening into its files. -->
{#snippet toggleRow(key: string, label: string, note: string, files: string[], ignored = false)}
  {@const open = expanded.includes(key)}
  <li class="min-w-0">
    <button
      type="button"
      class={[
        "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm text-left text-xs",
        ignored ? "text-amber-700 dark:text-amber-300" : "hover:bg-muted/60",
      ]}
      aria-expanded={open}
      onclick={() => toggleExpanded(key)}
    >
      {#if ignored}
        <TriangleAlertIcon class="size-3.5 shrink-0" />
      {:else}
        <DatabaseIcon class="text-muted-foreground size-3.5 shrink-0" />
      {/if}
      <span class="min-w-0 truncate" title={label}>{label}</span>
      <span class={["ml-auto shrink-0 tabular-nums", !ignored && "text-muted-foreground"]}>{note}</span>
      {#if open}
        <ChevronDownIcon class="size-3.5 shrink-0" />
      {:else}
        <ChevronRightIcon class="size-3.5 shrink-0" />
      {/if}
    </button>
    {#if open}
      <div class="mt-0.5 mb-1 ml-5">{@render fileList(files)}</div>
    {/if}
  </li>
{/snippet}

<!-- A folder or the loose files: the entries they become. -->
{#snippet fileList(names: string[])}
  <ul class="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
    <!-- by position: two different loose files can share a name -->
    {#each names.slice(0, MAX_LISTED_FILES) as name, index (index)}
      <li class="flex min-w-0 items-center gap-2 text-xs">
        <FileIcon class="text-muted-foreground size-3.5 shrink-0" />
        <span class="min-w-0 truncate" title={name}>{name}</span>
      </li>
    {/each}
    {#if names.length > MAX_LISTED_FILES}
      <li class="text-muted-foreground text-xs">and {count(names.length - MAX_LISTED_FILES, "more file")}</li>
    {/if}
  </ul>
{/snippet}

{#if mode === "datasets" && items.length > 0}
  {@render clearAll(items.length)}
  <section class={["max-h-72 divide-y overflow-y-auto rounded-lg border", items.length > 1 ? "mt-1" : "mt-3"]}>
    {#each items as item (item.key)}
      {@const canSplit = item.subFolders.length > 0}
      {@const splitting = canSplit && split.includes(item.key)}
      <PreviewUploadMediaItem
        name={item.name}
        icon={item.isZip ? FileArchiveIcon : item.isLoose ? FileIcon : FolderIcon}
        details={item.isLoose ? `1 dataset · ${count(item.files.length, "file")}` : datasetDetails(item, splitting)}
        warning={splitting && item.topFiles > 0 ? `${count(item.topFiles, "file")} ignored` : undefined}
        title={item.isLoose ? looseNameInput : undefined}
        onDelete={() => remove(item.files)}
        expanded={!item.isZip && expanded.includes(item.key)}
        onToggle={item.isZip ? undefined : () => toggleExpanded(item.key)}
      >
        {#snippet expansion()}
          {#if splitting}
            {@render datasetList(item)}
          {:else}
            {@render fileList(entryNames(item))}
          {/if}
        {/snippet}
        {#if canSplit}
          {@const id = `split-${item.key}`}
          <div class="flex shrink-0 items-center gap-1.5" title="Create one dataset per sub-folder">
            <Switch {id} checked={splitting} onCheckedChange={(on) => setSplit(item.key, on)} />
            <Label for={id} class="text-muted-foreground text-xs font-normal">Per sub-folder</Label>
          </div>
        {/if}
      </PreviewUploadMediaItem>
    {/each}
  </section>
{:else if mode === "entries" && picked.length > 0}
  {@render clearAll(picked.length)}
  <section class={["max-h-72 divide-y overflow-y-auto rounded-lg border", picked.length > 1 ? "mt-1" : "mt-3"]}>
    {#each picked as file, index (index)}
      <PreviewUploadMediaItem
        name={file.path}
        icon={/\.zip$/i.test(file.path) ? FileArchiveIcon : FileIcon}
        onDelete={() => remove([file])}
      />
    {/each}
  </section>
{/if}
