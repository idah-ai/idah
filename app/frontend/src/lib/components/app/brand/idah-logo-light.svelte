<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import idahLogoLightSvg from "@/components/app/brand/idah-logo-light.svg";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className }: WithElementRef<HTMLAttributes<HTMLImageElement>> = $props();
</script>

<img src={idahLogoLightSvg} alt="idah-logo-light" class={cn("size-24", className)} />
