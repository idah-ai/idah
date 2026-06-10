<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { CopyIcon, SquareCheckBigIcon } from "@lucide/svelte";

  // Props
  let {
    open = $bindable(),
    value,
  }: {
    open?: boolean;
    value: string;
  } = $props();

  // Variables
  let copied: boolean = $state(false);

  // Functions
  function copyApiKeyToClipboard(): void {
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

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>API Key Generated</DialogTitle>
      <DialogDescription>Your API key has been generated successfully.</DialogDescription>
    </DialogHeader>

    <ScrollArea class="max-h-[80vh] gap-0.5">
      <DialogDescription>This is your API key.</DialogDescription>
      <DialogDescription>The key is not recoverable, so be sure to copy it and store it securely.</DialogDescription>
      <DialogDescription>If you lose this key, you will need to generate a new one.</DialogDescription>
      <DialogDescription>Do not share it with others or expose it in public repositories.</DialogDescription>

      <div class="inline-flex w-full items-end gap-1">
        <InputField name="apiKey/generated" label="API Key" {value} readonly />

        <TooltipProvider disableCloseOnTriggerClick>
          <Tooltip delayDuration={0}>
            <TooltipTrigger>
              <Button disabled={copied} onclick={copyApiKeyToClipboard}>
                {#if copied}
                  <SquareCheckBigIcon class="size-4"></SquareCheckBigIcon>
                {:else}
                  <CopyIcon class="size-4"></CopyIcon>
                {/if}

                {copied ? "Copied!" : "Copy API Key"}
              </Button>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>
      </div>
    </ScrollArea>
  </DialogContent>
</Dialog>
