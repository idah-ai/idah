<script lang="ts">
  import { page } from "$app/state";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import { onMount } from "svelte";

  // Variables
  let entryId: string = page.params.entryId as string;

  let context_promise: Promise<IActivityContext> | undefined = $state();

  // Functions
  onMount(() => {
    context_promise = new Promise<IActivityContext>(async (ok, ko) => {
      entriesBackendDataSource
        .get(entryId, {
          included: ["dataset.project"],
        })
        .then(
          (entryRes) => ok(activityContextForEntry(entryRes.data)),
          () => ko(`could not retrieve entry ${entryId}`),
        );
    });
  });
</script>

{#if context_promise}
  {#await context_promise}
    <div class="flex h-screen flex-col items-center justify-center gap-2">
      <Spinner size="xl"></Spinner>
      <p class="text-muted-foreground text-sm">Loading context for {entryId}...</p>
    </div>
  {:then context}
    <IdahPlugin {context} />
  {/await}
{/if}
