<script lang="ts">
  import { page } from "$app/state";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Variables
  let entryId: string = page.params.entryId as string;

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
