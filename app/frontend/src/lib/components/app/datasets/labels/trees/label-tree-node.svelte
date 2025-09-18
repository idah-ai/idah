<script lang="ts" module>
  import Button from "@/components/ui/button/button.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import Kbd from "@/components/app/texts/kbd.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

  import { cn } from "@/utils";

  import { Layers2Icon, PlusIcon, SquareDashedMousePointerIcon, Trash2Icon } from "@lucide/svelte";

  export interface TreeItem {
    id: string;
    parent: string | null;
    type: string;
    label: string;
    color: string;
    children: TreeItem[];
  }

  interface TreeNodeProps {
    node: TreeItem;
    level: number;
    onAddCategory: (parentId?: string) => void;
    onRemoveCategory: (categoryId: string) => void;
  }

  // Variables
  let editLabel: boolean = $state(false);

  export { TreeNode };
</script>

{#snippet TreeNode(props: TreeNodeProps)}
  {@const { node, level, onAddCategory, onRemoveCategory } = props}

  <div id={node.id} class={cn("flex items-center gap-2")} style:margin-left={`${(level - 1) * 3}rem`}>
    <!-- TREE::NODE -->
    <div class="border-border e flex w-full items-center gap-2 rounded-lg border">
      <div class="rounded-bl-md rounded-tl-md bg-amber-500 p-4">
        {#if node.type?.includes("video")}
          <SquareDashedMousePointerIcon class="size-4"></SquareDashedMousePointerIcon>
        {:else}
          <Layers2Icon class="size-4"></Layers2Icon>
        {/if}
      </div>

      {#if !editLabel}
        <button onclick={() => (editLabel = true)}>
          <Text>{node.label}</Text>
        </button>
      {:else}
        <Input
          type="text"
          class="w-60"
          value={node.label}
          onblur={() => {
            editLabel = false;
          }}
        />
      {/if}

      <div class="ml-auto flex items-center justify-end gap-2 px-4">
        <Tooltip>
          <TooltipTrigger>
            <Kbd>⌘ {node.label.charAt(0)}</Kbd>
          </TooltipTrigger>

          <TooltipContent>Assign a shortcut</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" onclick={() => onAddCategory(node.id)}>
              <PlusIcon class="size-4"></PlusIcon>
            </Button>
          </TooltipTrigger>

          <TooltipContent>Add Sub-category</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" onclick={() => onRemoveCategory(node.id)}>
              <Trash2Icon class="size-4"></Trash2Icon>
            </Button>
          </TooltipTrigger>

          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </div>

  {#if node.children.length}
    {#each node.children as child}
      {@const level = child.id.split("/").length}
      {@render TreeNode({
        node: child,
        level: level,
        onAddCategory: onAddCategory,
        onRemoveCategory: onRemoveCategory,
      })}
    {/each}
  {/if}
{/snippet}
