<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Badge from "@/components/ui/badge/badge.svelte";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();
  $effect(() => {
    console.log(webhook.event_types);
  });
</script>

{#each webhook.event_types as eventType (eventType)}
  <div class="flex w-full items-center justify-between py-0.5">
    <Badge variant="outline">{eventType}</Badge>
  </div>
{:else}
  <Text>No event types available</Text>
{/each}
