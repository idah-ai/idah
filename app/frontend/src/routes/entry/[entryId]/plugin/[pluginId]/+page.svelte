<script lang="ts">
  import { page } from "$app/state";

  import IdahPlugin from "@/plugin/IdahPlugin.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Variables
  let entryId: string = page.params.entryId as string;
  let pluginId: string = page.params.pluginId as string;

  // Functions
  async function loadContext(): Promise<IActivityContext> {
    const entryRes = await entriesBackendDataSource.get(entryId, {
      included: ["dataset.project"],
    });

    const context = activityContextForEntry(entryRes.data);
    return context;
  }
</script>

{#await loadContext()}
  <div class="flex h-screen flex-col items-center justify-center gap-2">
    <Spinner size="xl"></Spinner>
    <p class="text-muted-foreground text-sm">Loading context for {entryId}...</p>
  </div>
{:then context}
  <IdahPlugin {context} />
{/await}
