<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import idahLogoDarkSvg from "@/components/app/brand/idah-logo-dark.svg";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className }: WithElementRef<HTMLAttributes<HTMLImageElement>> = $props();
</script>

<img src={idahLogoDarkSvg} alt="idah-logo-dark" class={cn("size-24", className)} />
