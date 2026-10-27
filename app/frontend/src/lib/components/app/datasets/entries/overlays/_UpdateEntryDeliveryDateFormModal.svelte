<script lang="ts">
  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { deliveryDateChangeSchema } from "@/data/model/dataset/datasets/schema";
  import { entriesBackendDataSource, type EntryRecord } from "@/data/model/dataset/entries/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors } from "@/utils/validate";
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
  import { onMount } from "svelte";

  let {
    entry,
    open = $bindable(false),
  }: {
    entry: EntryRecord;
    open?: boolean;
  } = $props();

  let selectedDeliveryDate = $state<string | null>(null);
  let submitting = $state(false);
  let errors = $state<string[]>([]);
  let changed = $derived(selectedDeliveryDate !== (entry.delivery_date || entry.dataset?.delivery_date || null));

  onMount(() => {
    selectedDeliveryDate = entry.delivery_date || entry.dataset?.delivery_date || null;
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
  {#key selectedDeliveryDate}
    <DatePickerField
      name="entry/delivery_date"
      label="Delivery Date"
      placeholder="Select delivery date (optional)"
      value={selectedDeliveryDate ? parseDate(selectedDeliveryDate).toDate(getLocalTimeZone()) : null}
      minDate={today(getLocalTimeZone())}
      clearable
      disabled={submitting}
      {errors}
      onDateSelected={(date) => {
        selectedDeliveryDate = date;
        errors = [];
      }}
    />
  {/key}
</FormModal>
