<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { createIdahDriverV2, IdahDriverV2 } from "@/plugin/v2/idah-driver";

  // Variables
  let entryId: string = page.params.entryId as string;
  let driverPromise: Promise<IdahDriverV2> | undefined = $state();

  // Lifecycle
  onMount(() => {
    driverPromise = createIdahDriverV2(entryId);
  });
</script>

{#if driverPromise}
  {#await driverPromise}
    <div class="flex h-screen flex-col items-center justify-center gap-2">
      <Spinner size="xl"></Spinner>
      <p class="text-muted-foreground text-sm">Loading context for {entryId}...</p>
    </div>
  {:then driver}
    <IdahPlugin {driver} />
  {/await}
{/if}
