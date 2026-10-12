<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SelectMultipleWebhookEventTypes from "@/components/app/notification/webhook/select/select-multiple-webhook-event-types.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

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
  let { name, url, events, secret_key, enabled } = $derived(webhook);
  let selectedEvents = $state<LabelValue<string | number>[]>(events.map((event) => ({ label: event, value: event })));

  // Functions
  function selectEvents(selectedChoices: LabelValue<string | number>[]): void {
    selectedEvents = selectedChoices;
    events = selectedChoices.map((choice) => String(choice.value));
  }

  $effect(() => {
    onValueChange({ name, url, events, secret_key, enabled });
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

    <!-- WEBHOOK::SECRET_KEY -->
    <InputField
      name="{resource}/secret_key"
      label="Secret Key"
      placeholder="Webhook Secret Key"
      required
      errors={fieldErrors["secret_key"]}
      value={secret_key}
      oninput={(e) => (secret_key = e.currentTarget.value)}
    />

    <!-- WEBHOOK::ENABLED -->
    <div class="flex items-center gap-2">
      <Switch id="{resource}/enabled" checked={enabled} onCheckedChange={(checkedValue) => (enabled = checkedValue)} />

      <div>
        <Label for="{resource}/enabled">Enabled</Label>
        <p class="text-muted-foreground text-sm">set whether the webhook is enabled or not</p>
      </div>
    </div>
  </FieldGroup>
</FieldSet>
