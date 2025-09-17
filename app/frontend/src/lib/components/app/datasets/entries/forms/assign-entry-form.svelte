<script lang="ts">
  import Form from "@/components/app/forms/form.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    selectedMember: number | null;
  }
  let { selectedMember, onValueChange }: Props = $props();

  // Variables
  const resource: string = EntryRecord.type;

  // Variables::Reactive
  let assignedToId = $derived(selectedMember);

  // Functions
  $effect(() => {
    onValueChange({ assigned_to_id: assignedToId });
  });
</script>

<Form>
  <!-- ENTRY::PROJECT MEMBERS -->
  {assignedToId || "null"}
</Form>
