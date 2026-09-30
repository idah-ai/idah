<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();
</script>

<Text>
  {webhook.name}
</Text>
