<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { reopenEntries } from "@/components/app/datasets/entries/util/entry-actions";
  // import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { pluralizeUnit } from "@/utils/unit";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props extends FormModalBaseProps {
    entryIds: string[];
    entryMap?: Map<string, EntryRecord>;
    onReopened?: (updatedEntries: EntryRecord[]) => void;
  }
  let { action, open = $bindable(), title = "Reopen Entry", entryIds, entryMap, onReopened }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);
  let selectedEntryCount: number = $derived(entryIds.length);
  const targetStageLabel = "Annotate";

  // Functions
  function getEntryName(id: string): string | undefined {
    return entryMap?.get(id)?.name;
  }

  async function submit(): Promise<void> {
    submitting = true;
    try {
      const updated = await reopenEntries(entryIds);
      if (!updated) return; // failure already toasted; keep modal open
      onReopened?.(updated);
      open = false;
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description={selectedEntryCount > 1
    ? `The selected entries will be moved back to ${targetStageLabel} and each entry is assigned back to its previous assignee.`
    : `This entry will be moved back to ${targetStageLabel} and assigned back to its previous assignee.`}
  loading={submitting}
  onCancel={() => {}}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <div class="flex flex-col gap-3">
    {#if selectedEntryCount > 0}
      <Text size="sm" weight="medium">{pluralizeUnit(selectedEntryCount, "Selected entry", "Selected entries")}</Text>
    {/if}

    <ul class="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
      {#each entryIds as id (id)}
        <li class="text-muted-foreground truncate text-sm">
          {getEntryName(id) || id}
        </li>
      {/each}
    </ul>
  </div>

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Reopening" onclick={submit}>Reopen</Button>
  {/snippet}
</FormModal>
