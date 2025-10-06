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
</script>

<VideoAnnotationActivity {context} />
