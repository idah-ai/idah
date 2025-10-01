<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { cn } from "@/utils";

  import { type Icon as IconType } from "@lucide/svelte";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    class?: string | null;
    icon?: typeof IconType;

    title?: string;
    slotTitle?: Snippet;

    description?: string;
    slotDescription?: Snippet;

    actions?: Snippet;
  }
  let { class: className, icon: Icon, title, slotTitle, description, slotDescription, actions }: Props = $props();
</script>

<div id="response-block-container" class={cn("flex flex-col items-center gap-4", className)}>
  <!-- RESPONSE BLOCK::ICON -->
  <div class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border">
    {#if Icon}
      <Icon class="size-4" />
    {/if}
  </div>

  <!-- RESPONSE BLOCK::CONTENT -->
  <div class="flex flex-col items-center gap-1">
    {#if slotTitle}
      {@render slotTitle?.()}
    {:else}
      <Text weight="semibold" class="capitalize">{title}</Text>
    {/if}

    {#if slotDescription}
      {@render slotDescription?.()}
    {:else}
      <Text size="sm" class="text-muted-foreground">{description}</Text>
    {/if}
  </div>

  <!-- RESPONSE BLOCK::ACTIONS -->
  {#if actions}
    {@render actions?.()}
  {:else}
    <Button class="capitalize">Action</Button>
  {/if}
</div>
