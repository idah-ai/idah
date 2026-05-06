<script lang="ts">
  import "./plugin.css";
  import { onMount } from "svelte";

  import VideoAnnotationActivity from "$lib/plugin/video-annotation-activity/video-annotation-activity.svelte";

  import { initDriver } from "$lib/state/driver.svelte";
  import { initDataStores } from "$lib/state/data.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { IIdahDriverV2 } from "$idah/v2/types";

  // Props
  interface Props {
    context: IActivityContext;
    /** Optional V2 driver — becomes globally accessible via `v2.driver` once set. */
    driver?: IIdahDriverV2;
  }
  let { context, driver }: Props = $props();

  // ── Expose the V2 driver to the entire app ───────────────────────────
  onMount(() => {
    if (driver) {
      initDriver(driver);
      initDataStores();
    }
  });
</script>

<VideoAnnotationActivity {context} />
