<script lang="ts">
    import { PluginManager } from '@/plugin/PluginManager';
    import config from '../../../plugins/plugins.config.json'
    import { setContext, type Snippet } from "svelte";

    type Props = {
        children: Snippet;
      }
    let { children }: Props = $props();

    const pluginManager = new PluginManager(config)

    setContext("idah-plugin-manager", pluginManager)
</script>

<div>
    {#await pluginManager.loadedPromise}
        loading plugins
    {:then}
        {@render children?.()}
    {/await}
</div>
