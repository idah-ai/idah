<script lang="ts">
    import IdahPlugin from "@/plugin/IdahPlugin.svelte";
    import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
    import { page } from "$app/state";
    // resolve records registration
    import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
    import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
    import { activityContextForEntry } from "@/plugin/ActivityContext";
    import type { PluginManager } from "@/plugin/PluginManager";

    let entry_id: string = page.params.entryId as string;
    let plugin_id: string = page.params.pluginId as string;


    console.debug("loading plugin context")
    let contextPromise = new Promise<IActivityContext>((resolve, reject) => {
        entriesBackendDataSource
            .get(entry_id, { included: ["dataset"] })
            .then(
                (entry) => {
                    const context = activityContextForEntry(entry.data)
                    console.log({context})
                    resolve(context)
                },
                (entry) => {
                    console.error({error: entry})
                    reject()
                }
            )
    })
</script>

{#await contextPromise}
    <p>Loading context for {entry_id}</p>
{:then context}
    <IdahPlugin {context} {plugin_id}/>
{/await}

