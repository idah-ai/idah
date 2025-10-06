<script lang="ts">
  import { onMount } from "svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import VideoAnnotationActivity from "./video-annotation-activity.svelte";
  import { page } from "$app/state";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { LabelingConfiguration } from "@/data/model/dataset/labels";

  // Props
  let { context }: { context: IActivityContext } = $props();

  // Variables
  let labelConfig: LabelingConfiguration | undefined = $state(undefined);

  //   Lifecycle
  onMount(async () => {
    await fetchLabelConfiguration();
  });

  // Functions
  async function fetchLabelConfiguration() {
    const entryId = page.params.entryId as string;
    const entryResponse = await entriesBackendDataSource.get(entryId, {
      fields: {
        [DatasetRecord.type]: ["labeling_configuration"],
      },
      included: ["dataset"],
    });
    const labelingConfiguration = entryResponse?.data.dataset.labeling_configuration;
    labelConfig = labelingConfiguration;
  }
</script>

{#if labelConfig}
  <VideoAnnotationActivity {context} {labelConfig} />
{/if}
