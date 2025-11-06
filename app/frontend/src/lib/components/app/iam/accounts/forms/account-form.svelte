<script lang="ts">
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    account: AccountRecord;
  }
  let { account, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = AccountRecord.type;

  // Variables::Reactive
  let name: string = $derived(account.name);
  let email: string = $derived(account.email);
  let enabled: boolean = $derived(account.enabled);

  // Functions
  $effect(() => {
    onValueChange({ name, email, enabled });
  });
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- ACCOUNT::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="E.g. John Doe"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />

    <!-- ACCOUNT::EMAIL -->
    <InputField
      name="{resource}/email"
      label="Email"
      placeholder="E.g. john.doe@example.com"
      type="email"
      required
      errors={fieldErrors["email"]}
      value={email}
      oninput={(e) => (email = e.currentTarget.value)}
    />

    <!-- ACCOUNT::ENABLED -->
    <CheckboxField
      name="{resource}/enabled"
      label="Enable account"
      info="Allow this account to access the application"
      bordered
      required
      errors={fieldErrors["enabled"]}
      bind:checked={enabled}
    ></CheckboxField>
  </FieldGroup>
</FieldSet>
