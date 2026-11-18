<script lang="ts">
  import { Trash2Icon } from "@lucide/svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { showConfirmDeleteAnnotationsDialog } from "$lib/components/App/ConfirmDialog/confirm-delete";

  import type { ContextMenuComponentProps } from "$lib/components/App/ContextMenu/store";
  import type { IVideoAnnotationRecord } from "$lib/types";

  interface Props extends ContextMenuComponentProps {
    ann: IVideoAnnotationRecord;
  }
  let { ann }: Props = $props();

  let locked = $derived(annotation.isLocked(ann));
</script>

<div class="bg-background my-1 flex flex-col">
  <Button
    variant="destructive-ghost"
    size="sm"
    class="mx-1 w-full justify-start"
    disabled={locked || !isEditable()}
    onclick={() => {
      const id = ann.id;
      if (!id) return;
      showConfirmDeleteAnnotationsDialog({
        count: 1,
        type: "tag",
        title: "Delete Video Tag",
        description: "Are you sure you want to delete this video tag?",
        onConfirm: () => {
          getDriver().command.call("idah-video:annotation.delete", { annotationId: id });
        },
      });
    }}
  >
    <Trash2Icon />
    Delete video tag
  </Button>
</div>
