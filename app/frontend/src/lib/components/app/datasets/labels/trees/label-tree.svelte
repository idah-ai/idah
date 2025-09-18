<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { TreeNode, type TreeItem } from "@/components/app/datasets/labels/trees/label-tree-node.svelte";

  import { humanize } from "@/utils/string";
  import { PlusIcon } from "@lucide/svelte";

  import type { Hash } from "@/utils/types";
  import type { LabelingConfiguration } from "@/data/model/dataset/types";

  // Props
  interface Props {
    labelConfig: LabelingConfiguration;
    onAddCategory: (parentId?: string) => void;
    onRemoveCategory: (categoryId: string) => void;
  }
  let { labelConfig, onAddCategory, onRemoveCategory }: Props = $props();

  // Variables
  let treeItems = $derived(constructTree(labelConfig));
  $inspect("treeItems", treeItems);

  // Functions
  function constructTree(config: LabelingConfiguration) {
    /** Build a nested object structure first */
    const root: Hash = {};

    for (const cat of config.categories) {
      const parts: Array<string> = cat.id.split("/");
      let currentNode = root;

      /** Walk through each page segment */
      parts.forEach((part, index) => {
        /** Create node if it doesn't exist */
        currentNode[part] = currentNode[part] || {
          __data: {
            id: part,
            parent: null,
            type: cat.type,
            label: humanize(part),
            color: cat.color,
          },
          __children: {},
        };

        /** At the last part, store the category info */
        if (index === parts.length - 1) {
          currentNode[part].__data = {
            id: cat.id,
            parent: parts.length > 1 ? parts[parts.length - 2] : null,
            type: cat.type,
            label: cat.label || humanize(part),
            color: cat.color,
          };
        }

        /** Move to the next level in the tree */
        currentNode = currentNode[part].__children;
      });
    }

    /** Convert the nested object structure to an array */
    function toArray(node: Hash): TreeItem[] {
      return Object.entries(node).map(([key, value]) => ({
        label: key,
        ...value.__data,
        children: toArray(value.__children),
      }));
    }

    return toArray(root);
  }
</script>

<!-- {#snippet TreeNode(props: TreeNode, opts: { level: number })}
  <div id={props.id} class={cn("flex items-center gap-2")} style:margin-left={`${(opts.level - 1) * 3}rem`}>
    <div class="border-border flex w-full items-center gap-2 rounded-lg border">
      <div class="rounded-bl-md rounded-tl-md bg-amber-500 p-4">
        {#if props.type?.includes("video")}
          <SquareDashedMousePointerIcon class="size-4"></SquareDashedMousePointerIcon>
        {:else}
          <Layers2Icon class="size-4"></Layers2Icon>
        {/if}
      </div>

      <button
        onclick={() => {
          console.log("Edit:", props.label);
        }}
      >
        <Text>{props.label}</Text>
      </button>

      <div class="ml-auto flex items-center gap-2 px-4">
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline" size="icon">
              <span>⌘{props.label.charAt(0)}</span>
            </Button>
          </TooltipTrigger>

          <TooltipContent>Assign a shortcut</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" onclick={() => onAddCategory(props.id)}>
              <PlusIcon class="size-4"></PlusIcon>
            </Button>
          </TooltipTrigger>

          <TooltipContent>Add Sub-category</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" onclick={() => onRemoveCategory(props.id)}>
              <Trash2Icon class="size-4"></Trash2Icon>
            </Button>
          </TooltipTrigger>

          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </div>

  {#if props.children.length}
    {#each props.children as child}
      {@const level = child.id.split("/").length}
      {@render TreeNode(child, { level: level })}
    {/each}
  {/if}
{/snippet} -->

<div class="flex w-full flex-col gap-4">
  <div id="trees" class="flex w-full flex-col gap-4">
    {#each treeItems as treeNode, index (index)}
      {@render TreeNode({ node: treeNode, level: 1, onAddCategory, onRemoveCategory })}
    {/each}
  </div>

  <div>
    <Button variant="outline" onclick={() => onAddCategory()}>
      <PlusIcon class="size-4"></PlusIcon>
      New Category
    </Button>
  </div>
</div>

<pre>
  {JSON.stringify(treeItems, null, 2)}
</pre>
