<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  
  import { mode } from "mode-watcher";
  
  import IdahLogoDark from "@/components/app/brand/idah-logo-dark.svelte";
  import IdahLogoLight from "@/components/app/brand/idah-logo-light.svelte";
  
  import { type WithElementRef } from "@/utils";

  // Props
  let { class: className }: WithElementRef<HTMLAttributes<HTMLImageElement>> = $props();

  // Variables
  let isLightMode = $state(mode.current === "light");
</script>

{#if isLightMode}
  <IdahLogoLight class={className} />
{:else}
  <IdahLogoDark class={className} />
{/if}
