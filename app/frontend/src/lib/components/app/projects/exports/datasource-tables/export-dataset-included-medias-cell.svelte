<script lang="ts">
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Badge } from "@/components/ui/badge";

  import { includeMedias } from "@/data/model/sync/exports/constant";
  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let includedMedia = $derived((exportRecord.job as unknown as SyncJobRecord).arguments.options?.include_medias ?? []);
  let foundIncludeMedia = $derived(includeMedias.find((item) => item.value == includedMedia));
</script>

<Tooltips>
  {#snippet trigger()}
    <Badge variant="outline">
      {foundIncludeMedia?.label || humanize(includedMedia)}
    </Badge>
  {/snippet}

  {#snippet content()}
    {foundIncludeMedia?.description}
  {/snippet}
</Tooltips>
