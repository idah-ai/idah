<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  // import { FieldGroup, FieldSet } from "@/components/ui/field";
  import { OrganizationRecord } from "@/data/model/dataset/organizations/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    organization: OrganizationRecord;
  }
  let { organization, fieldErrors, onValueChange }: Props = $props();

  // Variables
  let resource: string = OrganizationRecord.type;

  // Variables::Reactive
  let name: string = $derived(organization.name);

  // Functions
  $effect(() => {
    onValueChange({ name });
  });
</script>

<!-- <FieldSet class="p-1">
  <FieldGroup> -->
<Form>
  <!-- ORGANIZATION::NAME -->
  <InputField
    name="{resource}/name"
    label="Name"
    placeholder="Organization Name"
    required
    errors={fieldErrors["name"]}
    value={name}
    oninput={(e) => (name = e.currentTarget.value)}
  />
</Form>
<!-- </FieldGroup>
</FieldSet> -->
