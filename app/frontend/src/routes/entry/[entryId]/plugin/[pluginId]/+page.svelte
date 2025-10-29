<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Variables
  let entryId: string = page.params.entryId as string;

  let context_promise: Promise<IActivityContext> | undefined = $state();

  // Functions

  async function loadContext(): Promise<IActivityContext> {
    /**
     * Check the workflow step of the entry
     */
    const entryRes = await entriesBackendDataSource.get(entryId, {
      fields: {
        [EntryRecord.type]: ["wf_step"],
      },
      // included: ["dataset"],
    });

    /**
     * Start workflow event for an entry
     * If entry wf_step is not ['annotate', 'review', 'done', 'export']
     */
    if (entryRes.data.wf_step === "start") {
      await entriesBackendDataSource.submit(entryId);
    }

    /** Get the lastest entry record with dataset */
    const latestEntryRes = await entriesBackendDataSource.get(entryId, {
      included: ["dataset"],
    });

    const context = activityContextForEntry(latestEntryRes.data);
    return context;
  }

  onMount(() => {
    context_promise = new Promise<IActivityContext>(async (ok, ko) => {
      const entryRes = await entriesBackendDataSource.get(entryId, {
        included: ["dataset.project"],
      });

      if (!entryRes) ko(`could not retrieve entry ${entryId}`);
      else ok(activityContextForEntry(entryRes.data));
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
