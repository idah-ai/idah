<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import CardContent from "$lib/components/ui/card/card-content.svelte";
  import Card from "$lib/components/ui/card/card.svelte";
  import { CheckIcon, CopyIcon } from "@lucide/svelte";

  interface SnippetProps {
    code: string;
  }

  let { code }: SnippetProps = $props();

  let copied = $state(false);

  // Functions
  function copy(): void {
    navigator.clipboard.writeText(code);
    copied = true;
  }
</script>

<Card class="relative mx-auto w-full max-w-sm p-0">
  <CardContent class="relative p-0">
    <!-- Copy button -->
    <Button size="sm" class="absolute right-2 top-2 z-10 hover:cursor-pointer" disabled={copied} onclick={copy}>
      {#if copied}
        <CheckIcon />
        Copied
      {:else}
        <CopyIcon />
        Copy
      {/if}
    </Button>

    <!-- Code block -->
    <pre class="overflow-x-auto rounded-xl bg-background px-6 py-6 pt-16 text-sm leading-relaxed">
      <code class="block whitespace-pre font-mono text-foreground">{code}</code>
    </pre>
  </CardContent>
</Card>
