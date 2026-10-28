<script lang="ts">
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
  import { onMount } from "svelte";

  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import { Checkbox } from "@/components/ui/checkbox";
  import Text from "@/components/ui/text/Text.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors } from "@/utils/validate";

  import { deliveryDateChangeSchema } from "@/data/model/dataset/datasets/schema";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

  let {
    entry,
    open = $bindable(false),
  }: {
    entry: EntryRecord;
    open?: boolean;
  } = $props();

  let sameAsDatasetDeliveryDate = $state(false);
  let selectedDeliveryDate = $state<string | null>(null);
  let submitting = $state(false);
  let errors = $state<string[]>([]);
  let datasetDeliveryDate = $derived(entry.dataset?.delivery_date ?? null);
  let displayedDeliveryDate = $derived(sameAsDatasetDeliveryDate ? datasetDeliveryDate : selectedDeliveryDate);
  let changed = $derived(selectedDeliveryDate !== (entry.delivery_date ?? null));

  onMount(() => {
    selectedDeliveryDate = entry.delivery_date ?? null;
    sameAsDatasetDeliveryDate = entry.delivery_date == null || entry.delivery_date === datasetDeliveryDate;
  });

  async function submit() {
    if (!changed || submitting) return;
    submitting = true;
    errors = [];
    try {
      const result = deliveryDateChangeSchema.safeParse({
        delivery_date: selectedDeliveryDate,
        original_delivery_date: entry.delivery_date ?? null,
      });
      if (!result.success) {
        errors = (getFieldErrors(result.error) as { delivery_date?: string[] }).delivery_date ?? [];
        return;
      }
      await entriesBackendDataSource.update(
        entry.id,
        {
          attributes: { delivery_date: selectedDeliveryDate },
        },
        { showErrorToast: false },
      );
      $refetches.entries.list = new Date();
      $refetches.entries.get = new Date();
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
</FormModal>
