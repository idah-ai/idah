<script lang="ts">
  import Copyable from "@/components/app/texts/copyable.svelte";
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  let {
    open = $bindable(),
    value,
  }: {
    open?: boolean;
    value: string;
  } = $props();
</script>

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>API Key Generated</DialogTitle>
      <DialogDescription>Your API key has been generated successfully.</DialogDescription>
    </DialogHeader>

    <ScrollArea class="max-h-[80vh]">
      <DialogDescription>This is your API key.</DialogDescription>
      <DialogDescription>The key is not recoverable, so be sure to copy it and store it securely.</DialogDescription>
      <DialogDescription>If you lose this key, you will need to generate a new one.</DialogDescription>
      <DialogDescription>Do not share it with others or expose it in public repositories.</DialogDescription>

      <Copyable title="API Key" {value}>
        {#snippet slotValue()}
          <Text size="sm">{value}</Text>
        {/snippet}
      </Copyable>
    </ScrollArea>
  </DialogContent>
</Dialog>
