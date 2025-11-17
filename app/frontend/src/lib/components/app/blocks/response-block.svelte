<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

  import { cn } from "@/utils";

  import type { EmptyMediaVariant } from "@/components/ui/empty/empty-media.svelte";

  // Props
  interface Props {
    icon?: typeof IconType;

    title: string;
    description: string;

    size?: "sm" | "md";

    class?: string | null;
    actions?: Snippet;
  }
  let { icon: Icon, title, description, size = "md", class: className, actions }: Props = $props();

  // Variables
  interface ResponseBlockSize {
    icon: EmptyMediaVariant;
    title: string;
    description: string;
  }
  let responseBlockSize = $derived.by<ResponseBlockSize>(() => {
    switch (size) {
      case "sm": {
        return {
          icon: "icon-sm",
          title: "text-base",
          description: "text-xs/relaxed",
        };
      }
      default: {
        return {
          icon: "icon",
          title: "text-lg",
          description: "text-sm/relaxed",
        };
      }
    }
  });
</script>

<Empty class={cn("", className)}>
  <EmptyHeader>
    <EmptyMedia variant={Icon ? responseBlockSize.icon : "default"}>
      {#if Icon}
        <Icon />
      {/if}
    </EmptyMedia>

    <EmptyTitle class={responseBlockSize.title}>
      {title}
    </EmptyTitle>

    <EmptyDescription class={responseBlockSize.description}>
      {description}
    </EmptyDescription>
  </EmptyHeader>

  <EmptyContent class="flex-row justify-center">
    {@render actions?.()}
  </EmptyContent>
</Empty>
