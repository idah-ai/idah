<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    organization: AccountRecord;
  }
  let { organization, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = AccountRecord.type;

  // Variables::Reactive
  let name: string = $derived(organization.name);

  // Functions
  $effect(() => {
    onValueChange({ name });
  });
</script>

<Form>
  <!-- ORGANIZATION::NAME -->
  <InputField
    name="{resource}/name"
    label="Name"
    placeholder="Organization Name"
    required
    errors={fieldErrors["name"]}
    bind:value={name}
  />
</Form>
