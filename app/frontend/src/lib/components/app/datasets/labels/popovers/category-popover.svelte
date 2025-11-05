<script lang="ts">
  import { CheckIcon, SquareDashedMousePointerIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Button } from "@/components/ui/button";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { labelColors, type LabelConfigurationValue } from "@/data/model/dataset/labels";
  import { cn } from "@/utils";

  import type { ICategoryTreeNode } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";

  // Props
  interface Props {
    treeItem: ICategoryTreeNode;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: LabelConfigurationValue) => void;
  }
  let { treeItem, onEditCategoryId, onEditCategory }: Props = $props();

  // Variables
  let { id, color, text_color, label } = $derived(treeItem);

  // Functions
  function updateCategory(updatedFields: Partial<LabelConfigurationValue>) {
    onEditCategory({
      ...treeItem,
      ...updatedFields,
    });
  }
</script>

<Popover>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" class="px-2 text-sm">
        <!-- ICON -->
        <div
          class="flex size-5 items-center justify-center rounded-sm"
          style:background-color={color}
          style:color={text_color}
        >
          <SquareDashedMousePointerIcon class="size-3 text-white" />
        </div>

        <!-- KBD -->
        <KbdGroup>
          <Kbd>⌘ {treeItem.label.charAt(0)}</Kbd>
        </KbdGroup>

        <!-- LABEL -->
        {treeItem.label}
      </Button>
    {/snippet}
  </PopoverTrigger>

  <PopoverContent align="start" class="grid grid-cols-1 gap-2 p-2">
    <!-- ID -->
    {@const idParts = id.split("/")}
    {@const parentParts = idParts.splice(0, idParts.length - 1)}
    {@const parentPath = parentParts.join("/")}
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
    ></InputField>

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
    ></InputField>

    <!-- SHORTCUT KEY -->

    <!-- COLOR -->
    <div class="grid grid-cols-5 gap-1 px-2">
      {#each labelColors as { label, color: c, text_color } (c)}
        {@const isSelected = color === c}
        <Tooltips align="center" delayDuration={0}>
          {#snippet trigger()}
            <button
              class="inline-flex size-6 items-center justify-center rounded-lg border"
              style="background-color: {c}; color: {text_color}"
              onclick={() => updateCategory({ color: c, text_color })}
            >
              <CheckIcon class={cn("size-4", isSelected ? "opacity-100" : "opacity-0")}></CheckIcon>
            </button>
          {/snippet}

          {#snippet content()}
            {label}
          {/snippet}
        </Tooltips>
      {/each}
    </div>
  </PopoverContent>
</Popover>
