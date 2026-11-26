<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SwitchField from "@/components/app/forms/fields/input/switch-field.svelte";
  import SelectMultipleWebhookEventTypes from "@/components/app/notification/webhook/select/SelectMultipleWebhookEventTypes.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends FormBaseProps {
    webhook: WebhookRecord;
  }
  let { webhook, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = WebhookRecord.type;

  // Variables::Reactive
  let { name, url, events, enabled } = $derived(webhook);
  let selectedEvents = $derived<LabelValue<string | number>[]>(events.map((event) => ({ label: event, value: event })));

  // Functions
  function selectEvents(selectedChoices: LabelValue<string | number>[]): void {
    selectedEvents = selectedChoices;
    events = selectedChoices.map((choice) => String(choice.value));
  }

  $effect(() => {
    onValueChange({ name, url, events, enabled });
  });
</script>

<FieldSet class="p-1" name={resource}>
  <FieldGroup>
    <!-- WEBHOOK::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="Webhook Name"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
    <!-- WEBHOOK::URL -->
    <InputField
      name="{resource}/url"
      label="URL"
      placeholder="Webhook URL"
      required
      errors={fieldErrors["url"]}
      value={url}
      oninput={(e) => (url = e.currentTarget.value)}
    />

    <!-- WEBHOOK::events -->
    <SelectMultipleWebhookEventTypes
      name="{resource}/events"
      label="Event Types"
      placeholder="Select event types"
      required
      errors={fieldErrors["events"]}
      values={selectedEvents}
      onSelected={selectEvents}
    />

    <!-- WEBHOOK::ENABLED -->
    <SwitchField
      name="{resource}/enabled"
      label="Enabled"
      info="Set whether the webhook is enabled."
      checked={enabled}
      onCheckedChange={(checked) => (enabled = checked)}
    />
  </FieldGroup>
</FieldSet>
