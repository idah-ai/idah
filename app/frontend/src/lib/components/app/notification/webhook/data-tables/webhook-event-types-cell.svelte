<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  
  import { WebhookEventRecord } from "@/data/model/notification/webhooks/event/record";
  import { WebhookRecord } from "@/data/model/notification/webhooks/record";
  
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook, contexts }: DataTableCellBaseProps<WebhookRecord> = $props();

  const events: WebhookEventRecord[] = $derived(contexts?.webhookEvents ?? []);
  const eventsById = $derived(new Map(events.map((event) => [event.id, event])));
  const webhookEvents = $derived(
    webhook.events.map((eventId) => ({
      id: eventId,
      label: eventsById.get(eventId)?.label ?? eventId,
    })),
  );
</script>

{#each webhookEvents as eventType (eventType.id)}
  <div class="flex w-full items-center justify-between py-0.5">
    <Badge variant="outline">{eventType.label}</Badge>
  </div>
{:else}
  <Text>No event types available</Text>
{/each}
