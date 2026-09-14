<script lang="ts" module>
  import { ChevronRightIcon, GripVerticalIcon } from "@lucide/svelte";

  import CategoryDropdownMenusActions from "@/components/app/datasets/labels/dropdown-menus/category-dropdown-menus-actions.svelte";
  import CategoryPopover from "@/components/app/datasets/labels/popovers/category-popover.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { IConfigValue } from "@/plugin/v2/types";

  // Interfaces and Types
  interface ICategoryTreeNode extends IConfigValue {
    parent: string | null;
    children: Array<ICategoryTreeNode>;
    expanded: boolean;
    order: number;
  }

  // Drag-and-drop controller, owned by category-tree.svelte and threaded through
  // every (recursive) node so reorder state stays in one place.
  interface DragController {
    draggedId: string | null;
    dragOverId: string | null;
    dropPosition: "before" | "after" | null;
    start: (id: string) => void;
    over: (e: DragEvent, id: string) => void;
    leave: () => void;
    end: () => void;
    drop: (e: DragEvent, id: string) => void;
  }

  // Props
  interface CategoryTreeNodeProps {
    values: IConfigValue[];
    treeItem: ICategoryTreeNode;
    level: number;
    drag: DragController;
    onToggleExpand: (id: string) => void;
    onAddCategory: (nodeId?: string) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: IConfigValue) => void;
    onRemoveCategory: (categoryId: string) => void;
    onChangeSelectableCategory: (editedCategory: IConfigValue, selectable: boolean) => void;
  }

  export { CategoryTreeNode, type ICategoryTreeNode };
</script>

{#snippet CategoryTreeNode(props: CategoryTreeNodeProps)}
  {@const {
    values,
    treeItem,
    drag,
    onToggleExpand,
    onAddCategory,
    onEditCategoryId,
    onEditCategory,
    onRemoveCategory,
    onChangeSelectableCategory,
  } = props}
  {@const { id, children } = treeItem}
  {@const level = props.level}
  {@const hasChildren = children.length > 0}

  <div
    class={cn("group relative flex w-full items-center rounded-sm", {
      "before:bg-primary before:absolute before:inset-x-0 before:-top-px before:h-0.5":
        drag.dragOverId === id && drag.dropPosition === "before",
      "after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5":
        drag.dragOverId === id && drag.dropPosition === "after",
      "opacity-50": drag.draggedId === id,
    })}
    style:margin-left="{(level - 1) * 2}rem"
    role="treeitem"
    aria-selected="false"
    tabindex="-1"
    ondragover={(e) => drag.over(e, id)}
    ondragleave={drag.leave}
    ondrop={(e) => drag.drop(e, id)}
  >
    <span
      role="button"
      tabindex="-1"
      aria-label="Drag to reorder"
      draggable="true"
      class="cursor-grab opacity-0 transition-opacity duration-200 group-hover:opacity-100 active:cursor-grabbing"
      ondragstart={(e) => {
        e.dataTransfer?.setData("text/plain", id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        drag.start(id);
      }}
      ondragend={drag.end}
    >
      <GripVerticalIcon class="text-muted-foreground size-4" />
    </span>

    <Button
      variant="ghost"
      size="icon-sm"
      class={cn("", hasChildren ? "opacity-100" : "opacity-0")}
      onclick={() => onToggleExpand(id)}
    >
      <ChevronRightIcon
        class={cn("transition-transform duration-200", {
          "rotate-90": props.treeItem.expanded,
        })}
      />
    </Button>

    <CategoryPopover {values} {treeItem} {onEditCategoryId} {onEditCategory} {onChangeSelectableCategory} />

    <CategoryDropdownMenusActions
      {treeItem}
      class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      onAddSubCategory={() => onAddCategory(id)}
      onDeleteCategory={() => onRemoveCategory(id)}
    />
  </div>

  {#if props.treeItem.expanded}
    {#if hasChildren}
      {#each children as child (child.id)}
        {@const childLevel = level + 1}
        {@render CategoryTreeNode({
          values,
          treeItem: child,
          level: childLevel,
          drag,
          onToggleExpand,
          onAddCategory,
          onEditCategoryId,
          onEditCategory,
          onRemoveCategory,
          onChangeSelectableCategory,
        })}
      {/each}
    {/if}
  {/if}
{/snippet}
