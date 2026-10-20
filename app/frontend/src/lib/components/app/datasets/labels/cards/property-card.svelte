<script lang="ts">
  import RemovePropertyButton from "@/components/app/datasets/labels/buttons/remove-property-button.svelte";
  import ToggleShowContentButton from "@/components/app/datasets/labels/buttons/toggle-show-content-button.svelte";
  import PropertyTypeDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/property-type-dropdown-menu.svelte";
  import PropertyOptions from "@/components/app/datasets/labels/properties/property-options.svelte";
  import { Card, CardContent, CardHeader } from "@/components/ui/card";

  import { fieldTypes, type FieldType } from "@/data/model/dataset/labels";
  import { cn } from "@/utils";

  import type { IConfigProperty, IConfigValue } from "@/plugin/v2/types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    property: IConfigProperty;
    /** Categories and properties of the label config, for visibility conditions. */
    categories: IConfigValue[];
    properties: IConfigProperty[];
    /** Returns whether the update was applied. */
    onSetProperty: (property: IConfigProperty) => boolean;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { property, categories, properties, onSetProperty, onRemoveProperty }: Props = $props();

  // Variables
  let { id, label, type } = $derived(property);
  let showContent: boolean = $state(false);
  // Once opened, the options stay mounted while collapsed, so unsaved builder conditions survive.
  let opened: boolean = $state(false);

  let selectedFieldType: FieldType | undefined = $derived(fieldTypes.find((t) => t.value === type));

  // Functions
  function toggleContent() {
    showContent = !showContent;
    opened ||= showContent;
  }

  function setProperty(valueToSet: Hash): boolean {
    return onSetProperty({ ...property, ...valueToSet });
  }
</script>

<Card class="w-full gap-2 py-2">
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-0 px-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <ToggleShowContentButton {showContent} onClick={toggleContent} />

    <!-- HEADER::SELECT TYPE & TITLE -->
    <PropertyTypeDropdownMenu {label} {selectedFieldType} onSetLabel={setProperty} onSetType={setProperty} />

    <!-- HEADER::REMOVE BUTTON -->
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <RemovePropertyButton propertyKey="property" onClick={() => onRemoveProperty(id)} />
    </div>
  </CardHeader>

  <!-- CONTENT -->
  {#if opened}
    <CardContent class={cn("flex flex-col gap-4 px-0", !showContent && "hidden")}>
      <PropertyOptions {property} {categories} {properties} onSetValue={setProperty}></PropertyOptions>
    </CardContent>
  {/if}
</Card>
