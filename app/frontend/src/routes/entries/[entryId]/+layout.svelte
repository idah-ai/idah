<script lang="ts">
  import { setContext, type Snippet } from "svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { PluginManager } from "@/plugin/PluginManager";

  import config from "../../../plugins/plugins.config.json";

  // Props
  interface Props {
    children?: Snippet;
  }
  let { children }: Props = $props();

  //   Variables
  const pluginManager = new PluginManager(config);

  //   Contexts
  setContext("idah-plugin-manager", pluginManager);
</script>

{#await pluginManager.loadedPromise}
  <div class="flex h-screen flex-col items-center justify-center gap-2">
    <Spinner size="xl"></Spinner>
    <p class="text-muted-foreground text-sm">Loading plugins...</p>
  </div>
{:then}
  {@render children?.()}
{/await}
