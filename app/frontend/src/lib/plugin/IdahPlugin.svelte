<script lang="ts">
    import { getContext, onDestroy, onMount } from "svelte";
    import type { IActivityContext, IActivityView } from "./interface/Activity";
    import Button from "@/components/ui/button/button.svelte";

    let {context, plugin_id}:{context:IActivityContext, plugin_id: string} = $props()
    let container: HTMLElement

    import type { PluginManager } from "./PluginManager";
    let plugin: IActivityView|undefined = $state()

    let pluginManager:PluginManager = getContext('idah-plugin-manager')

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
        {#key plugin}
            {#if plugin}
                plugin render
            {:else}
                No registered {plugin_id} plugin found
            {/if}
        {/key}
    {/await}
</div>

