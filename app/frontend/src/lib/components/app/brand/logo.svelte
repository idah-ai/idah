<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import idahLogoSvg from "@/components/app/brand/idah-logo.svg";

  import { type WithElementRef } from "@/utils";

  // Props
  let { class: className }: WithElementRef<HTMLAttributes<HTMLImageElement>> = $props();
</script>

<img src={idahLogoSvg} alt="idah-logo" class={className} />
