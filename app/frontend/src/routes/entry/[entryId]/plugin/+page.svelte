<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { page } from "$app/state";

  let entryId: string = page.params.entryId as string;

  let plugins_promise: Promise<string[]> | undefined = $state();

  onMount(async () => {
    plugins_promise = new Promise<string[]>((resolve, reject) => {
      // pluginsBackendDataSource.modalities().then(async (modalities) => {
      entriesBackendDataSource.get(entryId, { included: ["dataset"] }).then((entry) => {
        // const plugins = modalities[entry.data.dataset.modality];

        // if (!plugins) reject(`no available plugin for modality ${entry.data.dataset.modality}`);

        // if (plugins.length == 1) goto(`plugin/${plugins[0]}`);

        goto(`plugin/idah-video`);
        // resolve(plugins);
      }, reject);
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
        {#each plugins as plugin}
          <li>
            <a href={plugin}>{plugin}</a>
          </li>
        {/each}
      </ul>
    {/await}
  {/if}
</div>
