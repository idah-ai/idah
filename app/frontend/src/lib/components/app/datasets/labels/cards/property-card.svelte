<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import PropertyOptions from "@/components/app/datasets/labels/properties/property-options.svelte";
  import PropertySelectors from "@/components/app/datasets/labels/properties/property-selectors.svelte";
  import PropertyTypeDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/property-type-dropdown-menu.svelte";
  import RemovePropertyButton from "@/components/app/datasets/labels/buttons/remove-property-button.svelte";
  import ToggleShowContentButton from "@/components/app/datasets/labels/buttons/toggle-show-content-button.svelte";

  import { fieldTypes, type PropertyField, type FieldType } from "@/data/model/dataset/labels";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    property: PropertyField;
    onSetProperty: (property: PropertyField) => void;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { property, onSetProperty, onRemoveProperty }: Props = $props();

  // Variables
  let { id, label, required, type, selector } = $derived(property);
  let showContent: boolean = $state(false);
  let editingLabel: boolean = $state(false);

  let selectedFieldType: FieldType | undefined = $derived(fieldTypes.find((t) => t.value === type));

  // Functions
  function toggleContent() {
    showContent = !showContent;
  }

  function setProperty(valueToSet: Hash) {
    onSetProperty({ ...property, ...valueToSet });
  }

  function assignCategory(params: { categoryId: string; isLastNode: boolean }) {
    const { categoryId, isLastNode } = params;
    const assigningSelectorId: string = isLastNode ? categoryId : `${categoryId}/*`;

    if (isLastNode) {
      /**
       * If the assigning selector is a last node,
       * Check each selector if there is any parent selector already exists,
       * If there is, remove the parent selector and add the last node selector,
       * If there is none, just add the last node selector.
       */
      const parentSelectors = selector.filter(
        (s) => assigningSelectorId.startsWith(s.split("/*")[0]) && s !== assigningSelectorId,
      );
      if (parentSelectors.length) {
        setProperty({
          selector: [...selector.filter((s) => !parentSelectors.includes(s)), assigningSelectorId],
        });
      } else if (!selector.includes(assigningSelectorId)) {
        // If not selected, add it
        setProperty({ selector: [...(selector || []), assigningSelectorId] });
      } else {
        // If already selected, remove it
        setProperty({
          selector: selector.filter((s) => s !== assigningSelectorId),
        });
      }
    } else {
      /**
       * If the assigning selector is not a last node,
       * Check if there are any children related to the selected category,
       * If there are, remove the children and add the selected category,
       * If there are none, just add the selected category.
       */
      const childSelectors = selector.filter((s) => s.startsWith(categoryId + "/") || s === categoryId);

      // Check if the selected category already exists in the selector
      const selectedCategoryExists = selector.includes(assigningSelectorId);

      if (selectedCategoryExists) {
        // If already selected, remove it
        setProperty({
          selector: selector.filter((s) => s !== assigningSelectorId),
        });
      } else {
        // If not selected, add it and remove any child selectors
        setProperty({
          selector: [...selector.filter((s) => !childSelectors.includes(s)), assigningSelectorId],
        });
      }
    }
  }
</script>

<Card class="w-full">
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <ToggleShowContentButton {showContent} onClick={toggleContent}></ToggleShowContentButton>

    <!-- HEADER::SELECT TYPE -->
    <PropertyTypeDropdownMenu {selectedFieldType} onSetType={setProperty}></PropertyTypeDropdownMenu>

    <!-- HEADER::EDITABLE TITLE -->
    <button class="cursor-text" onclick={() => (editingLabel = true)}>
      {#if editingLabel}
        <Input
          class="w-32"
          name="{id}/label"
          autofocus
          value={label}
          onblur={() => (editingLabel = false)}
          oninput={(e) => setProperty({ label: e.currentTarget.value })}
        ></Input>
      {:else}
        <CardTitle>{label}</CardTitle>
      {/if}
    </button>

    <div class="ml-auto flex items-center gap-2">
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
      <PropertyOptions propertyKey="properties" {property} onSetValue={setProperty}></PropertyOptions>

      <PropertySelectors {selector} onSelectCategory={assignCategory}></PropertySelectors>
    </CardContent>
  {/if}
</Card>
