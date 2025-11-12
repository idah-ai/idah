<script lang="ts">
  import RemovePropertyButton from "@/components/app/datasets/labels/buttons/remove-property-button.svelte";
  import ToggleShowContentButton from "@/components/app/datasets/labels/buttons/toggle-show-content-button.svelte";
  import PropertyTypeDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/property-type-dropdown-menu.svelte";
  import PropertyOptions from "@/components/app/datasets/labels/properties/property-options.svelte";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import { Card, CardContent, CardHeader } from "@/components/ui/card";

  import { fieldTypes, type FieldType, type LabelConfigurationProperty } from "@/data/model/dataset/labels";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    property: LabelConfigurationProperty;
    onSetProperty: (property: LabelConfigurationProperty) => void;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { property, onSetProperty, onRemoveProperty }: Props = $props();

  // Variables
  let { id, label, required, type } = $derived(property);
  let showContent: boolean = $state(false);

  let selectedFieldType: FieldType | undefined = $derived(fieldTypes.find((t) => t.value === type));

  // Functions
  function toggleContent() {
    showContent = !showContent;
  }

  function setProperty(valueToSet: Hash) {
    onSetProperty({ ...property, ...valueToSet });
  }
</script>

<Card class="w-full gap-2 py-2">
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-2 px-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <ToggleShowContentButton {showContent} onClick={toggleContent}></ToggleShowContentButton>

    <!-- HEADER::SELECT TYPE & TITLE -->
    <PropertyTypeDropdownMenu {label} {selectedFieldType} onSetLabel={setProperty} onSetType={setProperty}
    ></PropertyTypeDropdownMenu>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <!-- HEADER::REQUIRED -->
      <CheckboxField
        name="{id}/required"
        label="Required"
        bordered={false}
        checked={required}
        onCheckedChange={() => setProperty({ required: !required })}
      ></CheckboxField>

      <!-- HEADER::REMOVE BUTTON -->
      <RemovePropertyButton propertyKey="property" onClick={() => onRemoveProperty(id)}></RemovePropertyButton>
    </div>
  </CardHeader>

  <!-- CONTENT -->
  {#if showContent}
    <CardContent class="flex flex-col gap-4 px-0">
      <PropertyOptions {property} onSetValue={setProperty}></PropertyOptions>
    </CardContent>
  {/if}
</Card>
