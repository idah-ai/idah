<script lang="ts">
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
  import { onMount } from "svelte";

  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Item, ItemContent, ItemDescription } from "@/components/ui/item";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import Text from "@/components/ui/text/Text.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors } from "@/utils/validate";

  import { deliveryDateChangeSchema } from "@/data/model/dataset/datasets/schema";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

  let {
    entries,
    onUpdated,
    open = $bindable(false),
  }: {
    entries: EntryRecord[];
    onUpdated?: () => Promise<void>;
    open?: boolean;
  } = $props();

  let sameAsDatasetDeliveryDate = $state(false);
  let selectedDeliveryDate = $state<string | null>(null);
  let submitting = $state(false);
  let errors = $state<string[]>([]);
  let datasetDeliveryDate = $derived(entries[0]?.dataset?.delivery_date ?? null);
  let displayedDeliveryDate = $derived(sameAsDatasetDeliveryDate ? datasetDeliveryDate : selectedDeliveryDate);
  let changed = $derived(entries.some((entry) => selectedDeliveryDate !== (entry.delivery_date ?? null)));

  onMount(() => {
    const entry = entries[0];
    selectedDeliveryDate = entries.length === 1 ? (entry?.delivery_date ?? null) : datasetDeliveryDate;
    sameAsDatasetDeliveryDate =
      entries.length > 1 || entry?.delivery_date == null || entry.delivery_date === datasetDeliveryDate;
  });

  async function submit() {
    if (!changed || submitting) return;
    submitting = true;
    errors = [];
    try {
      const changedEntries = entries.filter((entry) => selectedDeliveryDate !== (entry.delivery_date ?? null));
      for (const entry of changedEntries) {
        const result = deliveryDateChangeSchema.safeParse({
          delivery_date: selectedDeliveryDate,
          original_delivery_date: entry.delivery_date ?? null,
        });
        if (!result.success) {
          errors = (getFieldErrors(result.error) as { delivery_date?: string[] }).delivery_date ?? [];
          return;
        }
      }
      try {
        for (const entry of changedEntries) {
          await entriesBackendDataSource.update(
            entry.id,
            { attributes: { delivery_date: selectedDeliveryDate } },
            { showErrorToast: false },
          );
        }
      } finally {
        $refetches.entries.list = new Date();
        $refetches.entries.get = new Date();
      }
      await onUpdated?.();
      showToast.success({ title: "Entry Delivery Date updated" });
      open = false;
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  action="update"
  title="Entry Delivery Date"
  bind:open
  loading={submitting}
  disabled={!changed}
  onConfirm={submit}
>
  {#key displayedDeliveryDate}
    <DatePickerField
      name="entry/delivery_date"
      label="Delivery Date"
      placeholder="Select delivery date (optional)"
      value={displayedDeliveryDate ? parseDate(displayedDeliveryDate).toDate(getLocalTimeZone()) : null}
      minDate={today(getLocalTimeZone())}
      clearable={!sameAsDatasetDeliveryDate}
      disabled={submitting || sameAsDatasetDeliveryDate}
      {errors}
      onDateSelected={(date) => {
        selectedDeliveryDate = date;
        errors = [];
      }}
    />
  {/key}
  <div class="mt-2 flex items-center gap-2">
    <Checkbox
      id="entry-same-as-dataset-delivery-date"
      checked={sameAsDatasetDeliveryDate}
      disabled={submitting}
      onCheckedChange={(checked) => {
        sameAsDatasetDeliveryDate = checked;
        selectedDeliveryDate = checked ? datasetDeliveryDate : null;
        errors = [];
      }}
    />
    <Text size="sm" class="text-muted-foreground">Same as dataset delivery date</Text>
  </div>
  <div class="mt-4 flex flex-col gap-1">
    <Text size="sm" weight="medium">{entries.length === 1 ? "Selected Entry" : "Selected Entries"}</Text>
    <ScrollArea class="max-h-40">
      {#each entries as entry (entry.id)}
        <Item class="py-1">
          <ItemContent>
            <ItemDescription>{entry.name}</ItemDescription>
          </ItemContent>
        </Item>
      {/each}
    </ScrollArea>
  </div>
</FormModal>
