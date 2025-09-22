<script lang="ts">
    import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entryRecord";
    import { activityContextForEntry } from "@/plugin/ActivityContext";
    import IdahPlugin from "@/plugin/IdahPlugin.svelte";
    import type { IActivityContext } from "@/plugin/interface/Activity";
    import { sleep } from "@/utils/delayed";
    import { onMount } from "svelte";

    let context : IActivityContext|undefined = $state()

    onMount(() => {
         // retrieve entry id from url ?
        entriesBackendDataSource.list({
            included: ["dataset"]
        }).then((entries) => {
            if (entries.data[0])
                sleep(2000).then(() => {
                    context = activityContextForEntry(entries.data[0])
                })
            else console.debug("no entry found")
        });
    })
</script>

{#if context}
    <IdahPlugin {context}/>
{:else}
    <p>Loading context ?</p>
{/if}


