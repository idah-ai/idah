<script lang="ts">
  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

  import { WebhookRecord, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    webhook: WebhookRecord;
  }
  let { webhook, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = WebhookRecord.type;

  // Variables::Reactive
  let { name, url, event_types, secret_key, enabled } = $derived(webhook);

  // Functions
  $effect(() => {
    onValueChange({ name, url, event_types, secret_key, enabled });
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

    <!-- WEBHOOK::EVENT_TYPES -->
    <MultipleSelectDatasourceField
      name="{resource}/event_types"
      values={event_types}
      dataSource={webhooksBackendDataSource}
      label="Event Types"
      placeholder="Select Event Types"
      required
      displayKey="name"
      clearable
      searchable
      searchKeyWithOperation="name__match"
      searchPlaceholder="Search event types by name"
      errors={fieldErrors["event_types"]}
      onSelected={(selectedChoice) => {
        event_types = selectedChoice.map((choice) => String(choice.value));
      }}
    >
      {#snippet slotTriggerValues({ selectedChoices })}
        <ComboboxTriggerValueBadges
          values={selectedChoices.map((choice) => choice.value)}
          dataSource={webhooksBackendDataSource}
          displayKey="name"
          maxShown={2}
        />
      {/snippet}
    </MultipleSelectDatasourceField>

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
