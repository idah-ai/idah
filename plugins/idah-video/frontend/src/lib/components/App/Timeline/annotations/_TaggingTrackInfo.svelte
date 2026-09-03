<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import Icon from "$lib/components/ui/Icon/Icon.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { findCategory } from "$lib/components/App/VideoAnnotationWorkspace/utils/category";

  import frameIconSvg from "$lib/assets/icons/frame.svg?raw";
  import videoIconSvg from "$lib/assets/icons/file.svg?raw";

  import { VIDEO_FRAME, ENTRY_ROOT, type IVideoAnnotationRecord } from "$lib/types";

  type Props = {
    row: {
      type: "entry" | "frame";
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

  const isAllHidden = $derived(annotations.length > 0 && annotations.every((a) => annotation.isHidden(a)));
  const isAllLocked = $derived(annotations.length > 0 && annotations.every((a) => annotation.isLocked(a)));
  const isSomeLocked = $derived(annotations.some((a) => annotation.isLocked(a)));

  // Header label: prefixed by type (Video / Image for entry, Frame for categories).
  const typeLabel = $derived(isEntry ? "Video" : "Frame");
  const categoryLabel = $derived(category?.label ?? (row.category ? categoryValueToLabel(row.category) : ""));
  // Entry row: modality label (Video/Image) on top, category below — like the frame row.
  const title = $derived(categoryLabel ? categoryLabel : "Uncategorized");
  const subtitle = $derived(isEntry ? typeLabel : "Frame");

  function toggleVisibility() {
    const newHidden = !isAllHidden;
    for (const a of annotations) annotation.toggleHidden(a.id, newHidden);
  }

  function toggleLocked() {
    const newLocked = !isAllLocked;
    for (const a of annotations) annotation.toggleLocked(a.id, newLocked);
  }

  function removeAll() {
    showConfirmDialog({
      title: `Remove ${typeLabel} tagging`,
      description: `Are you sure you want to remove all ${typeLabel} tagging annotations?`,
      onConfirm: () => {
        getDriver().command.call("idah-video:annotation.group.delete", {
          groupId: `__tagging__:${row.type}:${row.category ?? "entry"}`,
          annotations,
        });
      },
    });
  }
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

  <div class="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
    <KbdTooltipButton
      label={`Show/Hide ${typeLabel}`}
      icon={isAllHidden ? EyeOffIcon : EyeIcon}
      variant="ghost"
      size="icon-sm"
      disabled={annotations.length === 0}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        toggleVisibility();
      }}
    />
    <KbdTooltipButton
      label={`Lock/Unlock ${typeLabel}`}
      icon={isAllLocked ? LockIcon : LockOpenIcon}
      variant="ghost"
      size="icon-sm"
      disabled={annotations.length === 0}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        toggleLocked();
      }}
    />
    <KbdTooltipButton
      label={`Remove ${typeLabel}`}
      icon={Trash2Icon}
      variant="ghost"
      size="icon-sm"
      disabled={!isEditable() || annotations.length === 0 || isSomeLocked || viewport.isReviewWorkspace}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        removeAll();
      }}
    />
  </div>
</div>