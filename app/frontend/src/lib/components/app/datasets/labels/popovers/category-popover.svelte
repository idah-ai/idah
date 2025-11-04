<script lang="ts">
  import { CheckIcon, SquareDashedMousePointerIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Button } from "@/components/ui/button";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { labelColors } from "@/data/model/dataset/labels";

  import type { ICategoryTreeNode } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";

  // Props
  interface Props {
    treeItem: ICategoryTreeNode;
  }
  let { treeItem }: Props = $props();

  // Variables
  let { id, color: treeItemColor, label } = treeItem;
</script>

<Popover>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" class="px-2 text-sm">
        <!-- ICON -->
        <div class="flex size-5 items-center justify-center rounded-sm bg-amber-500">
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
      }}
    ></InputField>
    <!-- onEditCategoryId(node.id, newValue); -->

    <!-- LABEL -->
    <InputField
      name="{id}/label"
      class="px-2"
      label="Label"
      value={label}
      onblur={(e) => {
        const value = e.currentTarget.value;
      }}
    ></InputField>
    <!-- onEditCategory({
          id: node.id,
          type: node.type,
          color: node.color,
          text_color: node.text_color,
          label: value,
        }); -->

    <!-- SHORTCUT KEY -->

    <!-- COLOR -->
    <div class="grid grid-cols-5 gap-1 px-2">
      {#each labelColors as { label, color, text_color } (color)}
        <Tooltips delayDuration={0}>
          {#snippet trigger()}
            <button
              class="inline-flex size-6 items-center justify-center rounded-lg border"
              style="background-color: {color}; color: {text_color}"
              onclick={() => {}}
            >
              {#if treeItemColor === color}
                <CheckIcon class="size-4"></CheckIcon>
              {/if}
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
