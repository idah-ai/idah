<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    webhook: WebhookRecord;
  }
  let { webhook, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = WebhookRecord.type;

  // Variables::Reactive
  let { name, url, event_type, secret_key, enabled } = $derived(webhook);

  // Functions
  $effect(() => {
    onValueChange({ name, url, event_type, secret_key, enabled });
  });
</script>

<FieldSet class="p-1">
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

    <!-- WEBHOOK::EVENT_TYPE -->
    <InputField
      name="{resource}/event_type"
      label="Event Type"
      placeholder="Webhook Event Type"
      required
      errors={fieldErrors["event_type"]}
      value={event_type}
      oninput={(e) => (event_type = e.currentTarget.value)}
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

    <Switch id="enabled-webhook" checked={enabled} onCheckedChange={(checkedValue) => (enabled = checkedValue)} />
  </FieldGroup>
</FieldSet>
