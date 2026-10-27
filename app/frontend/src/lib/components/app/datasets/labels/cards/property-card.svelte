<script lang="ts">
  import { CircleAlertIcon } from "@lucide/svelte";

  import RemovePropertyButton from "@/components/app/datasets/labels/buttons/remove-property-button.svelte";
  import ToggleShowContentButton from "@/components/app/datasets/labels/buttons/toggle-show-content-button.svelte";
  import PropertyTypeDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/property-type-dropdown-menu.svelte";
  import PropertyOptions from "@/components/app/datasets/labels/properties/property-options.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Card, CardContent, CardHeader } from "@/components/ui/card";

  import { fieldTypes, type FieldType } from "@/data/model/dataset/labels";
  import { cn } from "@/utils";

  import type { IConfigProperty, IConfigValue } from "@/plugin/v2/types";
  import type { VisibilityReferenceError } from "@/components/app/datasets/labels/properties/visibility/visibility-fields";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    property: IConfigProperty;
    /** Categories and properties of the label config, for visibility conditions. */
    categories: IConfigValue[];
    properties: IConfigProperty[];
    visibilityErrors?: VisibilityReferenceError[];
    /** Returns whether the update was applied. */
    onSetProperty: (property: IConfigProperty) => boolean;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { property, categories, properties, visibilityErrors = [], onSetProperty, onRemoveProperty }: Props = $props();

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

<Card class={cn("w-full gap-2 py-2", visibilityErrors.length > 0 && "border-destructive/50 hover:border-destructive")}>
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-0 px-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <ToggleShowContentButton {showContent} onClick={toggleContent} />

    <!-- HEADER::SELECT TYPE & TITLE -->
    <PropertyTypeDropdownMenu {label} {selectedFieldType} onSetLabel={setProperty} onSetType={setProperty} />

    {#if visibilityErrors.length > 0}
      <Tooltips align="center">
        {#snippet trigger()}
          <CircleAlertIcon class="fill-destructive text-primary-foreground size-5" aria-label="Visibility error" />
        {/snippet}

        {#snippet content()}
          <div class="max-w-sm">
            <p class="font-medium">This property has an invalid visibility condition.</p>
            <ul class="mt-1 list-disc pl-4">
              {#each visibilityErrors as error (error)}
                <li>{error.message}</li>
              {/each}
            </ul>
          </div>
        {/snippet}
      </Tooltips>
    {/if}

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
