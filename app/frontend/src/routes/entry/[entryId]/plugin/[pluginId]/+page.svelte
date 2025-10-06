<script lang="ts">
  import { page } from "$app/state";

  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Variables
  let entry_id: string = page.params.entryId as string;
  let plugin_id: string = page.params.pluginId as string;

  console.debug("loading plugin context");
  let contextPromise = new Promise<IActivityContext>((resolve, reject) => {
    entriesBackendDataSource.get(entry_id, { included: ["dataset.project"] }).then(
      (entry) => {
        const context = activityContextForEntry(entry.data);
        console.log({ context });
        resolve(context);
      },
      (entry) => {
        console.error({ error: entry });
        reject();
      },
    );
  });
</script>

{#await contextPromise}
  <p>Loading context for {entry_id}</p>
{:then context}
  <IdahPlugin {context} {plugin_id} />
{/await}
