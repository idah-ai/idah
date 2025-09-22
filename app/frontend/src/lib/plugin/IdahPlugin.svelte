<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { IActivityContext, IActivityView } from "./interface/Activity";
    import { PluginManager } from "./PluginManager";
    import { sleep } from "@/utils/delayed";

    import config from '../../plugins/config.json' // ?

    let {context}:{context:IActivityContext} = $props()
    let container: HTMLElement

    let plugin: IActivityView|undefined = $state()

    const pluginManager = new PluginManager(context)

    console.debug('loading plugins')
    let pluginsLoad = Promise.all(config.plugins.map((plugin_config: {name:string, src: string}, i) => {
        console.debug("loading", plugin_config)
        return new Promise<void>((resolve, reject) => {
            pluginManager.load(plugin_config).then(
                (plugin) => {
                    resolve(plugin.init(context));
                }, reject
            )
        })
    }))


    onMount(() => {
        pluginsLoad.then(() => {
            sleep(1000).then(() => { // test purpose
                // what if multiple plugin found ?
                const plugins = pluginManager.getAllPlugins().filter((p) => p.type == context.type)

                plugin = plugins.reverse().at(0) //...

                console.debug("mounting plugin", $state.snapshot(plugin))

                if (!plugin) return console.error("plugin not found for", context)

                plugin.render?.(container)
            })

        })
    })

    onDestroy(() => {
        plugin?.close?.()
    })

</script>


<div bind:this={container}>
    Unplugged Container
</div>

