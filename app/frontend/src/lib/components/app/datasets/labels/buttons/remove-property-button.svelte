<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";

  import { Trash2Icon } from "@lucide/svelte";

  // Props
  interface Props {
    propertyKey: "property" | "tag";
    onClick: () => void;
  }
  let { propertyKey, onClick }: Props = $props();
</script>

<Tooltips>
  {#snippet trigger()}
    <Button variant="ghost" size="icon" onclick={onClick}>
      <Trash2Icon class="size-4"></Trash2Icon>
    </Button>
  {/snippet}

  {#snippet content()}
    Remove {propertyKey}
  {/snippet}
</Tooltips>
