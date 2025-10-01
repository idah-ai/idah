<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { truncate } from "@/utils/string";
  import { CopyIcon, SquareCheckBigIcon } from "@lucide/svelte";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    title?: string;
    value: string;
    slotValue?: Snippet;
  }
  let { title = "value", value, slotValue }: Props = $props();

  // Variables
  let copied: boolean = $state(false);

  // Functions
  function copyEmailToClipboard(): void {
    copied = true;
    navigator.clipboard.writeText(value);
    setTimeout(() => {
      removeCopiedState();
    }, 3000);
  }

  function removeCopiedState(): void {
    copied = false;
  }
</script>

<div id="email-container" class="hover:bg-primary/10 group inline-flex items-center gap-2 rounded-md px-2 py-0.5">
  {#if slotValue}
    {@render slotValue()}
  {:else}
    <Text size="sm">{truncate(value)}</Text>
  {/if}

  <TooltipProvider disableCloseOnTriggerClick>
    <Tooltip delayDuration={0}>
      <TooltipTrigger>
        <button
          id="copy-icon-container"
          class="cursor-pointer pt-1 opacity-0 transition-opacity group-hover:opacity-100"
          onclick={copyEmailToClipboard}
        >
          {#if copied}
            <SquareCheckBigIcon class="text-primary size-4" />
          {:else}
            <CopyIcon class="text-primary size-4" />
          {/if}
        </button>
      </TooltipTrigger>

      <TooltipContent>
        {copied ? "Copied!" : `Copy ${title}`}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
