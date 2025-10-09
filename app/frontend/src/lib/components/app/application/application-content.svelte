<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  import SidebarInset from "@/components/ui/sidebar/sidebar-inset.svelte";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<SidebarInset>
  <div class="@container/main flex flex-1 flex-col gap-4 p-4 pt-0">
    {@render children?.()}
  </div>
</SidebarInset>
