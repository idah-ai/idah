<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";

  import type { IVideoAnnotationRecord } from "$lib/types";

  // Shared show/hide + lock/unlock + delete trio for a list of annotations.
  // Used by the top-level header, the group headers, and the per-row tagging
  // actions so bulk toggles are wired once and always go through the undoable
  // group commands (idah-video:annotation.group.toggle-visibility /
  // toggle-editability) and the shared delete primitive
  // (idah-video:annotation.group.delete with an explicit annotations list).
  //
  // All labels are derived from a single natural-language noun phrase (`label`),
  // e.g. "video tag", "frame tags", "all annotations", "tags" — so every surface
  // gets context-specific wording without duplicating the label logic.

  type Props = {
    annotations: IVideoAnnotationRecord[];
    /** Natural-language noun phrase describing the target(s), e.g. "video tag",
     *  "frame tags", "all annotations". Drives the tooltip + confirm-dialog wording. */
    label: string;
    /** When true, the actions are hidden until the row is hovered (per-row context). */
    revealOnHover?: boolean;
  };
  let { annotations, label, revealOnHover = false }: Props = $props();

  const isAllHidden = $derived(annotations.length > 0 && annotations.every((a) => annotation.isHidden(a)));
  const isAllLocked = $derived(annotations.length > 0 && annotations.every((a) => annotation.isLocked(a)));
  const isSomeLocked = $derived(annotations.some((a) => annotation.isLocked(a)));

  const showLabel = $derived(isAllHidden ? `Show ${label}` : `Hide ${label}`);
  const lockLabel = $derived(isAllLocked ? `Unlock ${label}` : `Lock ${label}`);
  const deleteLabel = $derived(`Delete ${label}`);

  function toggleVisibility() {
    getDriver().command.call("idah-video:annotation.group.toggle-visibility", { annotations });
  }

  function toggleLocked() {
    getDriver().command.call("idah-video:annotation.group.toggle-editability", { annotations });
  }

  function removeAll() {
    showConfirmDialog({
      title: `Delete ${label}`,
      description: `Are you sure you want to delete ${label}?`,
      onConfirm: () => {
        getDriver().command.call("idah-video:annotation.group.delete", { annotations });
      },
    });
  }
</script>

<div
  class={revealOnHover
    ? "flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100"
    : "flex shrink-0 items-center"}
>
  <KbdTooltipButton
    label={showLabel}
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
    label={lockLabel}
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
    label={deleteLabel}
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