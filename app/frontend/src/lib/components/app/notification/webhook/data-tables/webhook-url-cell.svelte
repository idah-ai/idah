<script lang="ts">
  import Copyable from "@/components/app/texts/copyable.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();
</script>

<Copyable title="url" value={webhook.url}></Copyable>
