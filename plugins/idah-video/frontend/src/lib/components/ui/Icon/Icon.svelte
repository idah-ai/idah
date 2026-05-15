<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    src: string;
    color?: string | null;
    class?: string | null;
  }
  let { src, color, class: className }: Props = $props();
</script>

<div class={cn("shrink-0", color && "[&>svg]:!text-current", className)} style={color ? `color: ${color}` : ""}>
  {@html src}
</div>
