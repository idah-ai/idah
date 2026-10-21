<script lang="ts">
  import { onMount } from "svelte";
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { deliveryDateChangeSchema } from "@/data/model/dataset/datasets/schema";
  import { entriesBackendDataSource, type EntryRecord } from "@/data/model/dataset/entries/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors } from "@/utils/validate";

  let {
    entry,
    datasetDeliveryDate,
    open = $bindable(false),
  }: {
    entry: EntryRecord;
    datasetDeliveryDate: string | null;
    open?: boolean;
  } = $props();

  let selectedDeliveryDate = $state<string | null>(null);
  let submitting = $state(false);
  let errors = $state<string[]>([]);
  let changed = $derived(selectedDeliveryDate !== (entry.delivery_date ?? null));

  onMount(() => {
    selectedDeliveryDate = entry.delivery_date ?? null;
  });

  async function submit() {
    if (!changed || submitting) return;
    submitting = true;
    errors = [];
    try {
      if (selectedDeliveryDate !== null) {
        const dataset = await datasetsBackendDataSource.get(entry.dataset_id, { noCache: true });
        datasetDeliveryDate = dataset.data.delivery_date ?? null;
      }
      const result = deliveryDateChangeSchema.safeParse({
        delivery_date: selectedDeliveryDate,
        original_delivery_date: entry.delivery_date ?? null,
        dataset_delivery_date: datasetDeliveryDate,
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
      maxDate={datasetDeliveryDate ? parseDate(datasetDeliveryDate) : undefined}
      disabled={submitting ||
        (!!datasetDeliveryDate && parseDate(datasetDeliveryDate).compare(today(getLocalTimeZone())) < 0)}
      {errors}
      onDateSelected={(date) => {
        selectedDeliveryDate = date;
        errors = [];
      }}
    />
  {/key}
  {#if selectedDeliveryDate}
    <Button
      variant="outline"
      disabled={submitting}
      onclick={() => {
        selectedDeliveryDate = null;
        errors = [];
      }}>Clear Delivery Date</Button
    >
  {/if}
  {#if datasetDeliveryDate}
    <Text size="sm"
      >New dates must be on or before {datasetDeliveryDate}. Existing dates stay unchanged until you change them.</Text
    >
  {/if}
</FormModal>
