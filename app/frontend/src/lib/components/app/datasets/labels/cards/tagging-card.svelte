<script lang="ts">
  import { Card, CardContent, CardHeader } from "@/components/ui/card";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import PropertyOptions from "@/components/app/datasets/labels/properties/property-options.svelte";
  import PropertyTypeDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/property-type-dropdown-menu.svelte";
  import RemovePropertyButton from "@/components/app/datasets/labels/buttons/remove-property-button.svelte";
  import ToggleShowContentButton from "@/components/app/datasets/labels/buttons/toggle-show-content-button.svelte";

  import { fieldTypes, type FieldType, type TagField } from "@/data/model/dataset/labels";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    tag: TagField;
    onSetTag: (tag: TagField) => void;
    onRemoveTag: (tagId: string) => void;
  }
  let { tag, onSetTag, onRemoveTag }: Props = $props();

  // Variables
  let { id, type, label, required } = $derived(tag);
  let showContent: boolean = $state(false);

  let selectedFieldType: FieldType | undefined = $derived(fieldTypes.find((t) => t.value === type));

  // Functions
  function toggleContent() {
    showContent = !showContent;
  }

  function setTag(valueToSet: Hash) {
    onSetTag({ ...tag, ...valueToSet });
  }
</script>

<Card class="w-full">
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <ToggleShowContentButton {showContent} onClick={toggleContent}></ToggleShowContentButton>

    <!-- HEADER::SELECT TYPE & TITLE -->
    <PropertyTypeDropdownMenu {label} {selectedFieldType} onSetLabel={setTag} onSetType={setTag}
    ></PropertyTypeDropdownMenu>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <!-- HEADER::REQUIRED -->
      <CheckboxField
        name="{id}/required"
        label="Required"
        bordered={false}
        checked={required}
        onCheckedChange={() => setTag({ required: !required })}
      ></CheckboxField>

      <!-- HEADER::REMOVE BUTTON -->
      <RemovePropertyButton propertyKey="tag" onClick={() => onRemoveTag(id)}></RemovePropertyButton>
    </div>
  </CardHeader>

  <!-- CONTENT -->
  {#if showContent}
    <CardContent class="flex flex-col gap-4 px-0">
      <PropertyOptions property={tag} onSetValue={setTag}></PropertyOptions>
    </CardContent>
  {/if}
</Card>
