<script lang="ts">
  import Icon from "$lib/components/ui/Icon/Icon.svelte";

  import BulkActions from "$lib/components/App/Timeline/annotations/_BulkActions.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { findCategory } from "$lib/components/App/VideoAnnotationWorkspace/utils/category";

  import frameIconSvg from "$lib/assets/icons/frame.svg?raw";
  import videoIconSvg from "$lib/assets/icons/file.svg?raw";

  import { VIDEO_FRAME, ENTRY_ROOT, type IVideoAnnotationRecord } from "$lib/types";
  import type { TaggingRowKind } from "$lib/components/App/Timeline/types";

  type Props = {
    row: {
      type: TaggingRowKind;
      category?: string;
      annotations: IVideoAnnotationRecord[];
    };
  };
  let { row }: Props = $props();

  const annotations = $derived(row.annotations ?? []);
  const isEntry = $derived(row.type === "entry");

  // Resolve the category from the label config so we get the proper label + color.
  // The entry:root row carries its category on the annotation's value (not row.category).
  const shapeType = $derived(isEntry ? ENTRY_ROOT : VIDEO_FRAME);
  const categoryId = $derived(row.category ?? annotations[0]?.value?.category);
  const category = $derived(
    categoryId ? findCategory({ labelConfig: getDriver().config, categoryId, shapeType }) : undefined,
  );
  const color = $derived.by(() => {
    if (category?.color) return category.color;
    return annotations[0] ? resolveAnnotationColor(annotations[0]) : "gray";
  });

  // Header label: prefixed by type (Video / Image for entry, Frame for categories).
  const typeLabel = $derived(isEntry ? "Video" : "Frame");
  const categoryLabel = $derived(category?.label ?? (row.category ? categoryValueToLabel(row.category) : ""));
  // Entry row: modality label (Video/Image) on top, category below — like the frame row.
  const title = $derived(categoryLabel ? categoryLabel : "Uncategorized");
  const subtitle = $derived(isEntry ? typeLabel : "Frame");

  // Natural-language noun phrase for the bulk actions. The entry:root row always
  // acts on a single annotation ("video tag"); the frame row can act on many
  // frame annotations in one category at once, so it's plural ("frame tags").
  const bulkLabel = $derived(isEntry ? "video tag" : "frame tags");
</script>

<div class="group flex h-full w-full items-center gap-2 border-b px-2">
  {#if isEntry}
    <Icon src={videoIconSvg} {color} />
  {:else}
    <Icon src={frameIconSvg} {color} />
  {/if}

  <div class="flex min-w-0 flex-col">
    <span class="text-muted-foreground truncate text-xs">{subtitle}</span>
    <span class="truncate text-xs">{title}</span>
  </div>

  <div class="ml-auto">
    <BulkActions {annotations} label={bulkLabel} revealOnHover />
  </div>
</div>