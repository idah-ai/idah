<script lang="ts">
  import { Trash2Icon } from "@lucide/svelte";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Props
  interface Props {
    propertyKey: "property" | "tag";
    onClick: () => void;
  }
  let { propertyKey, onClick }: Props = $props();
</script>

<Tooltips align="center">
  {#snippet trigger()}
    <Button variant="ghost" size="icon-sm" onclick={onClick}>
      <Trash2Icon />
    </Button>
  {/snippet}

  {#snippet content()}
    Remove {propertyKey}
  {/snippet}
</Tooltips>
