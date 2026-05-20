<script lang="ts">
  import { ArrowLeftIcon } from "@lucide/svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";

  type Props = {
    driver: IdahDriverV2;
  };

  let { driver }: Props = $props();
</script>

<Button
  variant="outline"
  size="sm"
  onclick={async () => {
    // probably shouldnt need to make that call
    const entry = await entriesBackendDataSource.get(driver.id)
    goto(
      resolve(
        "/(protected)/(app)/projects/[projectId]/datasets/[datasetId]/entries", {
          projectId: entry.data.project_id,
          datasetId: entry.data.dataset_id,
        },
      )
    );
  }}
>
  <ArrowLeftIcon />
  Back
</Button>
