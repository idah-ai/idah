<script lang="ts">
    import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
    import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
    import { activityContextForEntry } from "@/plugin/ActivityContext";
    import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
    import { getContext, onMount } from "svelte";
    import { page } from "$app/state";
    import type { PluginManager } from "@/plugin/PluginManager";
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
    import { Button } from "@/components/ui/button";
    import { goto } from "$app/navigation";

    let entryId: string = page.params.entryId as string;
    let context:IActivityContext|undefined = $state()

    let pluginManager:PluginManager = getContext('idah-plugin-manager')
    let plugins: IActivityView[] = $state([])

    onMount(() => {
        entriesBackendDataSource
            .get(entryId, {included: ["dataset.project"]})
            .then(async entry => {
                    context = activityContextForEntry(entry.data)
                    let _plugins = pluginManager.getPluginsForType(context.type)
                    if (_plugins.length == 1){
                        goto(`plugin/${_plugins[0].name}`)
                    } else
                        plugins = _plugins
                })
    })


</script>

{#if plugins.length}
    <h3>Available Plugins</h3>
    <TooltipProvider>
        <ul>
            {#each plugins as plugin}
                <li>
                    <Tooltip>
                        <TooltipTrigger>
                            <Button onclick={() => goto(`plugin/${plugin.name}`)}>
                                {plugin.label}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {plugin.description}
                        </TooltipContent>
                    </Tooltip>

                </li>
            {/each}
        </ul>
    </TooltipProvider>
{:else}
    No available plugin
{/if}

