<script lang="ts">
  import Copyable from "@/components/app/texts/copyable.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";
  import { truncate } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();
</script>

<Copyable title="url" value={webhook.url}>
  {#snippet slotValue()}
    <Tooltips>
      {#snippet trigger()}
        {truncate(webhook.url)}
      {/snippet}

      {#snippet content()}
        {webhook.url}
      {/snippet}
    </Tooltips>
  {/snippet}
</Copyable>
