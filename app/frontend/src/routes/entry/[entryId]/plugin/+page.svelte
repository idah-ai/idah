<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import { Button } from "@/components/ui/button";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { activityContextForEntry } from "@/plugin/ActivityContext";

  import type { PluginManager } from "@/plugin/PluginManager";
  import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";

  // Variables
  let entryId = page.params.entryId as string;
  let context: IActivityContext | undefined = $state();

  let pluginManager: PluginManager = getContext("idah-plugin-manager");
  let plugins: IActivityView[] = $state([]);

  // Lifecycle
  onMount(() => {
    entriesBackendDataSource
      .get(entryId, {
        included: ["dataset"],
      })
      .then(async (entry) => {
        context = activityContextForEntry(entry.data);
        let registeredPlugins = pluginManager.getPluginsForType(context.type);

        if (registeredPlugins.length == 1) {
          /** Redirect to the single plugin's page */
          goto(`plugin/${registeredPlugins[0].name}`);
        } else {
          /** Show the list of available plugins */
          plugins = registeredPlugins;
        }
      });
  });
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
