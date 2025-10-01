<script lang='ts'>
    import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
    import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
    import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
    import { onMount } from "svelte";


    let entries: string[] = $state([])

    onMount(() => {
        entriesBackendDataSource.list().then(
            (r) => {
                entries = r.data.map(e => e.id)
            }
        )
    })

</script>


<div>Entries</div>
<ol>
    {#each  entries as entry }
        <li>
            <a href="entry/{entry}/plugin">{entry}</a>
        </li>
    {/each}
</ol>
