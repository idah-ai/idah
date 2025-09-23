<script lang="ts">
    import IdahPlugin from "@/plugin/IdahPlugin.svelte";
    import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
    import { getContext, onMount } from "svelte";
    import { page } from "$app/state";
    import { entriesBackendDataSource } from "@/data/model/dataset/entryRecord";
    import { activityContextForEntry } from "@/plugin/ActivityContext";
    import type { PluginManager } from "@/plugin/PluginManager";

    let entry_id: string = page.params.entryId as string;
    let plugin_id: string = page.params.pluginId as string;


    console.log("pluginID page")
    let contextPromise = new Promise<IActivityContext>((resolve, reject) => {
        entriesBackendDataSource
            .get(entry_id, { included: ["dataset"] })
            .then(
                (entry) => {
                    console.log(entry)
                    resolve(activityContextForEntry(entry.data))
                },
                (entry) => {
                    console.error({error: entry})
                    reject()
                }
            )
    })
    console.log("promise", contextPromise)
</script>

{#await contextPromise}
    <p>Loading context for {entry_id}</p>
{:then context}
    <IdahPlugin {context} {plugin_id}/>
{/await}

