<script lang="ts">
  import { CheckIcon, SquareDashedMousePointerIcon } from "@lucide/svelte";

  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import ColorPickerField from "@/components/app/forms/fields/picker/color-picker-field.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Button } from "@/components/ui/button";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Separator from "@/components/ui/separator/separator.svelte";

  import { labelColors } from "@/data/model/dataset/labels";
  import { cn } from "@/utils";

  import type { ICategoryTreeNode } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";
  import type { IConfigValue } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    values: IConfigValue[];
    treeItem: ICategoryTreeNode;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: IConfigValue) => void;
    onChangeSelectableCategory: (editedCategory: IConfigValue, selectable: boolean) => void;
  }
  let { values, treeItem, onEditCategoryId, onEditCategory, onChangeSelectableCategory }: Props = $props();

  // Variables
  let { id, color, text_color, label, children } = $derived(treeItem);
  let selectable = $derived.by(() => {
    /** If the category has no children, it is selectable */
    if (children.length === 0) return true;

    /** If the category exists in the values list, it is selectable */
    if (values.find((v) => v.id === id)) return true;

    /** Otherwise, root it is not selectable (by default) */
    return false;
  });
  let disabledSelectable = $derived(children.length === 0);

  // Functions
  function updateCategory(updatedFields: Partial<IConfigValue>) {
    onEditCategory({
      ...(treeItem as IConfigValue),
      ...updatedFields,
    });
  }
</script>

<Popover>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" class="px-2 text-sm">
        <!-- ICON -->
        {#if color !== null}
          <div
            class="flex size-5 items-center justify-center rounded-sm"
            style:background-color={color || "#000000"}
            style:color={text_color || "#FFFFFF"}
          >
            <SquareDashedMousePointerIcon class="size-3 text-white" />
          </div>
        {/if}

        <!-- KBD -->
        <KbdGroup>
          <Kbd>⌘ {treeItem.label.charAt(0)}</Kbd>
        </KbdGroup>

        <!-- LABEL -->
        {treeItem.label}
      </Button>
    {/snippet}
  </PopoverTrigger>

  <PopoverContent align="start" class="grid grid-cols-1 gap-2 px-0 py-2">
    {@const idParts = id.split("/")}
    {@const parentParts = idParts.splice(0, idParts.length - 1)}
    {@const parentPath = parentParts.join("/")}

    <div class="flex flex-col gap-2">
      <section class="flex flex-col gap-4 p-2">
        <InputField
          name="{id}/id"
          class="px-2"
          label="ID"
          prefix={parentPath ? `${parentPath}/` : ""}
          value={idParts[idParts.length - 1]}
          onblur={(e) => {
            const value = e.currentTarget.value;
            const newValue = parentPath ? `${parentPath}/${value}` : value;
            onEditCategoryId(id, newValue);
          }}
        />

        <!-- LABEL -->
        <InputField
          name="{id}/label"
          class="px-2"
          label="Label"
          value={label}
          onblur={(e) => {
            const value = e.currentTarget.value;
            updateCategory({ label: value });
          }}
        />

        <!-- SHORTCUT KEY -->

        <!-- SELECTABLE -->
        <CheckboxField
          name="{id}/selectable"
          class="mx-2"
          label="Selectable"
          bordered
          info="Determines if this category can be selected when labeling data or not."
          disabled={disabledSelectable}
          checked={selectable}
          onCheckedChange={(checked) => onChangeSelectableCategory(treeItem as IConfigValue, checked)}
        />
      </section>

      <!-- COLOR -->
      {#if selectable}
        <Separator />
        <section class="flex flex-col gap-2 p-2">
          <ColorPickerField
            name="{id}/text_color"
            label="Color"
            value={text_color || "#000000"}
            onValueChange={(value) => updateCategory({ text_color: value })}
          />

          <FormFieldLabel required={false} class="px-2">Color</FormFieldLabel>
          <div class="grid grid-cols-5 gap-1">
            {#each labelColors as { label, color: c, text_color } (c)}
              {@const isSelected = color === c}
              <Tooltips align="center" delayDuration={0}>
                {#snippet trigger()}
                  <button
                    class="inline-flex size-6 items-center justify-center rounded-lg border"
                    style="background-color: {c}; color: {text_color}"
                    onclick={() => updateCategory({ color: c, text_color })}
                  >
                    <CheckIcon class={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
                  </button>
                {/snippet}

                {#snippet content()}
                  {label}
                {/snippet}
              </Tooltips>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </PopoverContent>
</Popover>
