<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  // Props
  interface Props {
    showContent: boolean;
    onClick: () => void;
  }
  let { showContent, onClick }: Props = $props();
</script>

<Button variant="ghost" size="icon" onclick={onClick}>
  {#if showContent}
    <ChevronDownIcon class="size-4"></ChevronDownIcon>
  {:else}
    <ChevronRightIcon class="size-4"></ChevronRightIcon>
  {/if}
</Button>
