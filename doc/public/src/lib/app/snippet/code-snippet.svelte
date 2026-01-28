<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import CardContent from "$lib/components/ui/card/card-content.svelte";
  import Card from "$lib/components/ui/card/card.svelte";
  import { CheckIcon, CopyIcon } from "@lucide/svelte";

  interface SnippetProps {
    code: string;
    showCopyButton?: boolean;
  }

  let { code, showCopyButton = true }: SnippetProps = $props();

  let copied = $state(false);

  // Functions
  function copy(): void {
    navigator.clipboard.writeText(code);
    copied = true;
  }
</script>

<Card class="mx-auto w-full p-0 max-w-screen">
  <CardContent class="relative p-0">
    <!-- Copy button -->
    {#if showCopyButton}
      <Button
        size="sm"
        class="absolute right-2 top-2 sm:right-3 sm:top-3 z-10 flex items-center gap-1"
        disabled={copied}
        onclick={copy}
      >
        {#if copied}
          <CheckIcon class="size-3 sm:size-4" />
          <span class="hidden sm:inline">Copied</span>
        {:else}
          <CopyIcon class="size-3 sm:size-4" />
          <span class="hidden sm:inline">Copy</span>
        {/if}
      </Button>
    {/if}

    <!-- Code block -->
    <pre
      class="overflow-x-auto rounded-xl bg-background px-3 py-3 pt-12 sm:px-4 sm:py-4 sm:pt-14 lg:px-6 lg:py-6 lg:pt-16
      ">
      <code class="block whitespace-pre font-mono text-foreground">
        {code}
      </code>
    </pre>
  </CardContent>
</Card>
