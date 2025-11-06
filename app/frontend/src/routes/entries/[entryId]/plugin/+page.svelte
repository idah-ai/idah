<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { onMount } from "svelte";

  let entryId: string = page.params.entryId as string;

  let plugins_promise: Promise<string[]> | undefined = $state();

  onMount(async () => {
    plugins_promise = new Promise<string[]>((ok, ko) => {
      // pluginsBackendDataSource.modalities().then(async (modalities) => {
      entriesBackendDataSource.get(entryId, { included: ["dataset"] }).then((entry) => {
        // const plugins = modalities[entry.data.dataset.modality];
        const plugins = ["idah-video"];

        if (!plugins) ko(`no available plugin for modality ${entry.data.dataset.modality}`);

        if (plugins.length == 1)
          goto(
            resolve("/entries/[entryId]/plugin/[pluginId]", {
              entryId: entry.data.id,
              pluginId: plugins[0],
            }),
          );

        ok(plugins);
      }, ko);
      // }, reject);
    });
  });
</script>

<div>
  {#if !plugins_promise}
    init
  {:else}
    {#await plugins_promise}
      checking for plugins
    {:then plugins}
      <p>plugins</p>
      <ul>
        {#each plugins as plugin, i (i)}
          <li>
            <a href={plugin}>{plugin}</a>
          </li>
        {/each}
      </ul>
    {/await}
  {/if}
</div>
