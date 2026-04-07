<script lang="ts">
  import { PlusIcon, Trash2Icon } from "@lucide/svelte";

  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { borderTypes } from "@/data/model/dataset/labels";

  import type { IConfigProperty } from "@/plugin/interface/Activity";
  import type { Hash } from "@/utils/types";

  import { ASTNodeToFunctionString } from "@/utils/ast_resolution";
  import * as parser from "@build/parser.js";

  // Props
  interface Props {
    property: IConfigProperty;
    onSetValue: (valueToSet: Hash) => void;
  }
  let { property, onSetValue }: Props = $props();

  // Variables
  let { id, description, type, format, required, visibility } = $derived(property);
</script>

{#snippet SectionHeading(heading: string)}
  <Text size="sm" class="text-muted-foreground">{heading}</Text>
{/snippet}

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-2 px-6">
    <!-- PROPERTY OPTIONS:: DESCRIPTION -->
    <TextareaField
      name="{id}/description"
      label="Description"
      value={description}
      oninput={(e) => onSetValue({ description: e.currentTarget.value })}
    />

    <!-- PROPERTY::REQUIRED -->
    <CheckboxField
      name="{id}/required"
      label="Required"
      bordered
      info="If checked, this property must be filled before submission."
      checked={required}
      onCheckedChange={() => onSetValue({ required: !required })}
    ></CheckboxField>
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
        <Card class="gap-1">
          <CardHeader>
            <CardTitle class="text-sm">Option {index + 1}</CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() =>
                  onSetValue({ format: { ...format, options: format.options?.filter((_, i) => i !== index) } })}
              >
                <Trash2Icon />
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent>
            <div class="grid grid-cols-2 gap-2">
              <InputField
                class="flex-1"
                name="{id}/option_{index}/id"
                label="ID"
                placeholder="ID"
                value={option.id}
                oninput={(e) =>
                  onSetValue({
                    format: {
                      ...format,
                      options: format.options?.map((opt, i) =>
                        i === index ? { ...opt, id: e.currentTarget.value } : opt,
                      ),
                    },
                  })}
              />
              <InputField
                class="flex-1"
                name="{id}/option_{index}/label"
                label="Label"
                placeholder="Label"
                value={option.label}
                oninput={(e) =>
                  onSetValue({
                    format: {
                      ...format,
                      options: format.options?.map((opt, i) =>
                        i === index ? { ...opt, label: e.currentTarget.value } : opt,
                      ),
                    },
                  })}
              />

              <CheckboxField
                class="col-span-2"
                name="{id}/option_{index}/styles/hidden"
                label="Set styles?"
                checked={!!option.styles}
                onCheckedChange={(checked) =>
                  onSetValue({
                    format: {
                      ...format,
                      options: format.options?.map((opt, i) =>
                        i === index ? { ...opt, styles: checked ? {} : undefined } : opt,
                      ),
                    },
                  })}
              />

              {#if !!option.styles}
                <NumberField
                  class="col-span-2"
                  name="{id}/opacity_{index}/opacity"
                  label="Opacity"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="0 - 100"
                  value={option.styles.opacity}
                  oninput={(e) =>
                    onSetValue({
                      format: {
                        ...format,
                        options: format.options?.map((opt, i) =>
                          i === index
                            ? { ...opt, styles: { ...opt.styles, opacity: e.currentTarget.valueAsNumber } }
                            : opt,
                        ),
                      },
                    })}
                />
                <SingleSelectField
                  class="col-span-2"
                  name="{id}/border_{index}/border"
                  label="Border"
                  value={option.styles.border || null}
                  clearable
                  choices={borderTypes}
                  onSelected={(value) =>
                    onSetValue({
                      format: {
                        ...format,
                        options: format.options?.map((opt, i) =>
                          i === index ? { ...opt, styles: { ...opt.styles, border: value } } : opt,
                        ),
                      },
                    })}
                ></SingleSelectField>
              {/if}
            </div>
          </CardContent>
        </Card>
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
  <div class="flex flex-col gap-2 px-6 pb-4">
    <TextareaField
      name="{id}/visibility"
      class="col-span-1 md:col-span-2"
      label="Visibility"
      placeholder="e.g. task_name match '...' and status = '...'"
      value={visibility == false ? "" : ASTNodeToFunctionString(visibility)}
      oninput={(e) => {
        const inputValue = e.currentTarget.value;

        try {
          const parsed = parser.parse(inputValue);

          onSetValue({
            visibility: parsed.length ? parsed : false,
          });
        } catch (_) {
          onSetValue({
            visibility: false,
          });
        }
      }}
    />
  </div>
</div>
