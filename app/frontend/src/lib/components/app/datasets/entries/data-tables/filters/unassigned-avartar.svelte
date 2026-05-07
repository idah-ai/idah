<script lang="ts">
  import { CheckIcon } from "@lucide/svelte";

  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

  import { cn } from "@/utils";
  import { getAvatarFallback } from "@/utils/string";

  // Props
  interface Props {
    class?: string;
    isSelected?: boolean;
  }
  let { class: className, isSelected }: Props = $props();

  // Variables
  const name = "Unassigned";
</script>

<div class="group flex items-center gap-2">
  <Avatar class={cn("size-8 rounded-full text-sm", className)}>
    <AvatarImage alt={name} />
    <AvatarFallback
      class={cn("group-hover:bg-primary/10 rounded-lg", {
        "bg-primary group-hover:bg-primary": isSelected,
      })}
    >
      {#if isSelected}
        <CheckIcon class="text-primary-foreground size-4" />
      {:else}
        {getAvatarFallback(name)}
      {/if}
    </AvatarFallback>
  </Avatar>

  <div class="grid flex-1 text-left text-sm leading-tight">
    <span class="font-medium">{name}</span>
  </div>
</div>
