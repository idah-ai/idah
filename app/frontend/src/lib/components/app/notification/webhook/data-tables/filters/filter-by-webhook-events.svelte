<script lang="ts" generics="T extends Record">
  import WebhookEventTypesField from "@/components/app/notification/webhook/forms/webhook-event-types-field.svelte";

  import { Record } from "@/data/model/Record";
  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type {
      DataTableColumnFilterOperation,
      DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { LabelValue } from "@/utils/types";

  // Props
  let { columnSetting, filters, onFilter }: DataTableFilterBaseProps<T> = $props();

  // Variables
  const resource: string = WebhookRecord.type;
  let filterKey: string = $derived(columnSetting.filterOptions?.filterKey || "events");
  let filterOperation: DataTableColumnFilterOperation = $derived(columnSetting.filterOptions?.filterOperation || "in");
  let filterKeyWithOperation: string = $derived(`${filterKey}__${filterOperation}`);
  let selectedEvents = $state<LabelValue<string | number>[]>(getSelectedEvents());

  // Functions
  function getSelectedEvents(): LabelValue<string | number>[] {
    const values = filters[filterKeyWithOperation] || [];
    return values.map((value: string | number) => ({ label: String(value), value }));
  }

  function handleFilter(selectedChoices: LabelValue<string | number>[]): void {
    selectedEvents = selectedChoices;

    onFilter({
      filters: {
        [filterKeyWithOperation]: selectedChoices.map((choice) => choice.value),
      },
    });
  }
</script>

<WebhookEventTypesField
  name="{resource}/events"
  placeholder="Select event types"
  required
  values={selectedEvents}
  onSelected={handleFilter}
/>
