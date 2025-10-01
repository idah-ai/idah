<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";

  import { PlusIcon, Trash2Icon } from "@lucide/svelte";

  import type { Hash } from "@/utils/types";
  import type { FieldBase } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    property: FieldBase;
    onSetValue: (valueToSet: Hash) => void;
  }
  let { property, onSetValue }: Props = $props();

  // Variables
  let { id, description, type, format } = $derived(property);

  // let propertyKeyChoices = $derived(
  //   labelConfig[propertyKey].map((property) => ({
  //     label: property.label,
  //     value: property.id,
  //   })),
  // );
  // let allPropertiesHasBeenAddedToVisibleIf = $derived(
  //   labelConfig[propertyKey].length === Object.keys(visible_if || {}).length,
  // );
</script>

{#snippet SectionHeading(heading: string)}
  <Text size="sm" class="text-muted-foreground">{heading}</Text>
{/snippet}

<div class="flex flex-col gap-4">
  <!-- PROPERTY OPTIONS:: DESCRIPTION -->
  <div class="flex flex-col gap-2 px-6">
    <TextareaField
      name="{id}/description"
      label="Description"
      value={description}
      oninput={(e) => onSetValue({ description: e.currentTarget.value })}
    ></TextareaField>
  </div>

  <!-- PROPERTY OPTIONS::FORMAT -->
  <Separator></Separator>
  <div class="flex flex-col gap-2 px-6">
    {@render SectionHeading("Options")}

    <!-- PROPERTY OPTIONS::TYPE::TEXT -->
    {#if type === "text"}
      <div class="grid grid-cols-2 gap-2">
        <NumberField
          name="{id}/minimum"
          label="Minimum"
          placeholder="e.g. 0"
          value={format.minimum}
          oninput={(e) => onSetValue({ format: { ...format, minimum: e.currentTarget.valueAsNumber } })}
        ></NumberField>
        <NumberField
          name="{id}/maximum"
          label="Maximum"
          placeholder="e.g. 100"
          value={format.maximum}
          oninput={(e) => onSetValue({ format: { ...format, maximum: e.currentTarget.valueAsNumber } })}
        ></NumberField>
      </div>
    {/if}

    <!-- PROPERTY OPTIONS::TYPE::INTEGER -->
    {#if type === "integer"}
      <div class="grid grid-cols-2 gap-2">
        <NumberField
          name="{id}/minimum"
          label="Minimum"
          placeholder="e.g. 0"
          value={format.minimum}
          oninput={(e) => onSetValue({ format: { ...format, minimum: e.currentTarget.valueAsNumber } })}
        ></NumberField>
        <NumberField
          name="{id}/maximum"
          label="Maximum"
          placeholder="e.g. 100"
          value={format.maximum}
          oninput={(e) => onSetValue({ format: { ...format, maximum: e.currentTarget.valueAsNumber } })}
        ></NumberField>
        <NumberField
          name="{id}/step"
          label="Step"
          placeholder="e.g. 0.5"
          value={format.step}
          oninput={(e) => onSetValue({ format: { ...format, step: e.currentTarget.valueAsNumber } })}
        ></NumberField>
      </div>
    {/if}

    <!-- PROPERTY OPTIONS::TYPE::[SINGLE SELECT, MULTIPLE SELECT] -->
    {#if type.includes("select")}
      {#each format.options as option, index (index)}
        <div class="flex items-center gap-2">
          <InputField
            class="flex-1"
            name="{id}/option_{index}/id"
            label={index ? undefined : "ID"}
            placeholder="ID"
            value={option.id}
            oninput={(e) =>
              onSetValue({
                format: {
                  ...format,
                  options: format.options.map((opt, i) => (i === index ? { ...opt, id: e.currentTarget.value } : opt)),
                },
              })}
          ></InputField>
          <InputField
            class="flex-1"
            name="{id}/option_{index}/label"
            label={index ? undefined : "Label"}
            placeholder="Label"
            value={option.label}
            oninput={(e) =>
              onSetValue({
                format: {
                  ...format,
                  options: format.options.map((opt, i) =>
                    i === index ? { ...opt, label: e.currentTarget.value } : opt,
                  ),
                },
              })}
          ></InputField>
          <Button
            variant="ghost"
            size="icon"
            onclick={() => onSetValue({ format: { ...format, options: format.options.filter((_, i) => i !== index) } })}
          >
            <Trash2Icon class="size-4"></Trash2Icon>
          </Button>
        </div>
      {/each}

      <Button
        variant="outline"
        size="sm"
        onclick={() =>
          onSetValue({
            format: {
              ...format,
              options: [
                ...(format.options || []),
                {
                  id: `option_${(format.options || []).length + 1}`,
                  label: `Option ${(format.options || []).length + 1}`,
                },
              ],
            },
          })}
      >
        <PlusIcon class="size-4"></PlusIcon>
        Add Option
      </Button>
    {/if}

    <InputField
      name="{id}/info"
      class="col-span-1 md:col-span-2"
      label="Info"
      placeholder="e.g. Enter a valid email address"
      value={format.info}
      oninput={(e) => onSetValue({ format: { ...format, info: e.currentTarget.value } })}
    ></InputField>
  </div>

  <!-- PROPERTY::CONDITIONAL VISIBLE -->
  <!-- <Separator></Separator>
  <div class="flex flex-col gap-2 px-6">
    <div class="flex items-center justify-between gap-4">
      {@render SectionHeading("Conditional Visibility")}

      <Badge
        variant="secondary"
        class={cn(
          allPropertiesHasBeenAddedToVisibleIf ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer",
        )}
        onclick={() => {
          if (allPropertiesHasBeenAddedToVisibleIf) return;

          const firstUnselectedProperty = labelConfig.properties.find((p) => !visible_if?.[p.id]);

          if (firstUnselectedProperty) {
            onSetValue({
              visible_if: { ...(visible_if || {}), [firstUnselectedProperty.id]: [] },
            });
            return;
          } else {
            alert("All properties have been added");
          }
        }}
      >
        <PlusIcon class="size-4"></PlusIcon>
        Add Condition
      </Badge>
    </div>

    <div class="flex items-center gap-2">
      {#if visible_if}
        {#each Object.entries(visible_if) as [key, value] (key)}
          {@const property = labelConfig.properties.find((p) => p.id === key)}

          {#if property}
            <SingleSelectField name="{id}/visible_if/{key}" class="flex-1" choices={propertyKeyChoices} value={key}
            ></SingleSelectField>

            <div class="flex-1">
              {#if property.type === "text"}
                <InputField name="{id}/visible_if/{key}/value" placeholder="Value" value={null}></InputField>
              {/if}

              {#if property.type === "integer"}
                <NumberField name="{id}/visible_if/{key}/value" placeholder="Value" value={null}></NumberField>
              {/if}

              {#if property.type.includes("select")}
                Select
              {/if}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onclick={() => {
                const { [key]: _, ...rest } = visible_if;
                onSetValue({ visible_if: rest });
              }}
            >
              <Trash2Icon class="size-4"></Trash2Icon>
            </Button>
          {/if}
        {/each}
      {:else}{/if}
    </div>
  </div> -->
</div>
