<script lang="ts">
  import { EllipsisVerticalIcon, Trash2Icon, WorkflowIcon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { ICategoryTreeNode } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    treeItem: ICategoryTreeNode;
    class?: string | null;
    onAddSubCategory: (parentId: string) => void;
    onDeleteCategory: (categoryId: string) => void;
  }
  let { treeItem, class: className, onAddSubCategory, onDeleteCategory }: Props = $props();

  // Variables
  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Add sub-category",
          icon: WorkflowIcon,
          action: () => {
            onAddSubCategory(treeItem.id);
          },
        },
        {
          label: "Delete category",
          icon: Trash2Icon,
          action: () => {
            onDeleteCategory(treeItem.id);
          },
        },
      ],
    },
  };
</script>

<DropdownMenus {menus}>
  {#snippet trigger({ props })}
    {@const isOpen = props["data-state"] === "open"}

    <Button
      {...props}
      variant={isOpen ? "secondary" : "ghost"}
      size="icon-sm"
      class={cn("", className, {
        "opacity-100": isOpen,
      })}
    >
      <EllipsisVerticalIcon />
    </Button>
  {/snippet}
</DropdownMenus>
