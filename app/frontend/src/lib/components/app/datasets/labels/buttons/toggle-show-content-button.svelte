<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Props
  interface Props {
    showContent: boolean;
    onClick: () => void;
  }
  let { showContent, onClick }: Props = $props();
</script>

<Tooltips>
  {#snippet trigger()}
    <Button variant="ghost" size="icon-sm" onclick={onClick}>
      {#if showContent}
        <ChevronDownIcon />
      {:else}
        <ChevronRightIcon />
      {/if}
    </Button>
  {/snippet}

  {#snippet content()}
    {showContent ? "Hide" : "Show"} Content
  {/snippet}
</Tooltips>
