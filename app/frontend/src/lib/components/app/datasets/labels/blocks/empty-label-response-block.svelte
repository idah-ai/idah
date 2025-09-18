<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  import { PlusIcon, SquareDashedMousePointerIcon } from "@lucide/svelte";

  // Props
  interface Props {
    onNewLabel: () => void;
  }
  let { onNewLabel }: Props = $props();
</script>

<ResponseBlock
  class="flex min-h-[32rem] items-center justify-center"
  icon={SquareDashedMousePointerIcon}
  title="No labelling jobs"
  description="Please add a labeling job to get started."
>
  {#snippet actions()}
    <Button onclick={onNewLabel}>
      <PlusIcon class="size-4"></PlusIcon>
      New labelling job
    </Button>
  {/snippet}
</ResponseBlock>
