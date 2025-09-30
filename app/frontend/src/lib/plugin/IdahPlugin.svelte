<script lang="ts">
    import { getContext, onDestroy, onMount } from "svelte";
    import type { IActivityContext, IActivityView } from "./interface/Activity";
    import Button from "@/components/ui/button/button.svelte";

    let {context, plugin_id}:{context:IActivityContext, plugin_id: string} = $props()
    let container: HTMLElement

    import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
    import TooltipTrigger from "@/components/ui/tooltip/tooltip-trigger.svelte";
    import TooltipContent from "@/components/ui/tooltip/tooltip-content.svelte";
    import type { PluginManager } from "./PluginManager";
    import { goto } from "$app/navigation";
    let plugin: IActivityView|undefined = $state()

    let pluginManager:PluginManager = getContext('idah-plugin-manager')
    let plugins: IActivityView[] = $state([])

    onMount(() => {
        pluginManager.loadedPromise.then(() => {
            plugin = pluginManager.getPlugin(plugin_id)
            if (!plugin) return console.error("plugin not found", {plugin_id})

            console.debug("Mounting plugin", $state.snapshot(plugin))
            plugin.render?.(container, context)
        })
    })

    onDestroy(() => {
        plugin?.close?.()
    })

</script>


<div bind:this={container}>
    {#await pluginManager.loadedPromise}
        Loading Plugins
    {:then}
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
    {/await}
</div>

