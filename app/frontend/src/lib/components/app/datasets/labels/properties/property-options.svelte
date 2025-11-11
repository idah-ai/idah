<script lang="ts">
  import { PlusIcon, Trash2Icon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import type { LabelConfigurationProperty } from "@/data/model/dataset/labels";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    property: LabelConfigurationProperty;
    onSetValue: (valueToSet: Hash) => void;
  }
  let { property, onSetValue }: Props = $props();

  // Variables
  let { id, description, type, format, visibility } = $derived(property);

  import * as parser from "@build/parser.js";
  import { ASTNodeToFunctionString } from "../../../../../../plugins/idah-video/test_ast_resolution";
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
    />
  </div>

  <!-- PROPERTY OPTIONS::FORMAT -->
  <Separator />
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
        />
        <NumberField
          name="{id}/maximum"
          label="Maximum"
          placeholder="e.g. 100"
          value={format.maximum}
          oninput={(e) => onSetValue({ format: { ...format, maximum: e.currentTarget.valueAsNumber } })}
        />
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
        />
        <NumberField
          name="{id}/maximum"
          label="Maximum"
          placeholder="e.g. 100"
          value={format.maximum}
          oninput={(e) => onSetValue({ format: { ...format, maximum: e.currentTarget.valueAsNumber } })}
        />
        <NumberField
          name="{id}/step"
          label="Step"
          placeholder="e.g. 0.5"
          value={format.step}
          oninput={(e) => onSetValue({ format: { ...format, step: e.currentTarget.valueAsNumber } })}
        />
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
          />
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
          />
          <Button
            variant="ghost"
            size="icon"
            onclick={() => onSetValue({ format: { ...format, options: format.options.filter((_, i) => i !== index) } })}
          >
            <Trash2Icon />
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
        <PlusIcon />
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
    />
  </div>

  <!-- PROPERTY::CONDITIONAL VISIBLE -->
  <Separator />
  <div class="flex flex-col gap-2 px-6">
    <TextareaField
      name="{id}/visibility"
      class="col-span-1 md:col-span-2"
      label="Visibility"
      placeholder="e.g. task_name match '...' and status = '...'"
      value={ASTNodeToFunctionString(visibility)}
      oninput={(e) => {
        try {
          const visibility = parser.parse(e.currentTarget.value);
          onSetValue({ visibility });
        } catch (error) {
          console.error(error);
        }
      }}
    />
  </div>
</div>
