<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { mode } from "mode-watcher";

  import idahLogoDarkSvg from "@/components/app/brand/idah-logo-dark.svg";
  import idahLogoLightSvg from "@/components/app/brand/idah-logo-light.svg";

  import { cn, type WithElementRef } from "@/utils";

  // Props
  let { class: className }: WithElementRef<HTMLAttributes<HTMLImageElement>> = $props();

  // Variables
  let isLightMode = $derived(mode.current === "light")
</script>

<img src={isLightMode ? idahLogoLightSvg : idahLogoDarkSvg} alt="idah-logo-{isLightMode ? "light" : "dark"}" class={cn("size-24", className)} />
