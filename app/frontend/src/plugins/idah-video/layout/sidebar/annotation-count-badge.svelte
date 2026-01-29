<script lang="ts">
  import { cn } from "@/utils";

  // Props
  interface Props {
    class?: string | null;
    count: number;
  }
  let { class: className, count }: Props = $props();

  // Variables
  let displayCount = $derived.by(() => {
    if (count > 99) return "99+";
    return count;
  });
</script>

<div
  class={cn(
    "text-secondary-foreground [a&]:hover:bg-secondary/90 ml-auto rounded-full border-transparent bg-gray-200 px-1.5 py-0.5 text-[0.625rem] dark:bg-gray-600",
    className,
  )}
>
  {displayCount}
</div>
