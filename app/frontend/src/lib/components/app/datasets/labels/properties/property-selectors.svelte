<script lang="ts">
  import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { constructTree, type TreeItem } from "@/data/model/dataset/dataset-record";
  import { cn } from "@/utils";

  import type { LabelingConfiguration } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    selector: Array<string>;
    onSelectCategory: (params: { categoryId: string; isLastNode: boolean }) => void;
  }
  let { selector, onSelectCategory }: Props = $props();

  // Contexts
  let labelConfig = getContext("labelConfig") as LabelingConfiguration;

  // Variables
  let open: boolean = $state(false);
  let treeItems = $derived(constructTree(labelConfig));
</script>

{#snippet CategoryTreeNode(props: { node: TreeItem; level: number })}
  {@const { node, level } = props}
  {@const marginLeft = `${(level - 1) * 1}rem`}
  <Button
    variant="ghost"
    class="hover:bg-primary/10 justify-start"
    onclick={() => onSelectCategory({ categoryId: node.id, isLastNode: node.children.length === 0 })}
  >
    <div class="flex items-center gap-2" style:margin-left={marginLeft}>
      <CheckIcon
        class={cn(
          "size-4",
          selector.some((s) => `${node.id}/`.startsWith(s.split("*")[0])) ? "opacity-100" : "opacity-0",
        )}
      ></CheckIcon>

      {node.label}
    </div>
  </Button>

  {#if node.children.length}
    {#each node.children as child (child.id)}
      {@const nextLevel = level + 1}
      {@render CategoryTreeNode({ node: child, level: nextLevel })}
    {/each}
  {/if}
{/snippet}

<Separator></Separator>
<div class="flex flex-col gap-4">
  <!-- CONTENT::SELECTORS -->
  <div class="flex items-center justify-between gap-4 px-6">
    <Text size="sm" class="text-muted-foreground">Assigned Categories</Text>

    <Popover bind:open>
      <PopoverTrigger>
        <Badge variant="secondary">
          <PlusIcon class="size-4"></PlusIcon>
          Assign Category
          <ChevronsUpDownIcon class="size-4"></ChevronsUpDownIcon>
        </Badge>
      </PopoverTrigger>

      <PopoverContent align="end" class="w-fit min-w-60 p-0">
        <div class="px-2 py-1.5">
          <Text size="sm" weight="semibold">Select Category</Text>
        </div>
        <Separator></Separator>

        <div class="flex w-full flex-col px-2 py-1">
          {#each treeItems as treeNode, index (index)}
            {@render CategoryTreeNode({ node: treeNode, level: 1 })}
          {/each}
        </div>
      </PopoverContent>
    </Popover>
  </div>

  <div class="flex flex-wrap items-center gap-2 px-6">
    {#each selector as selector, index (index)}
      <Badge variant="outline" class="font-mono">{selector}</Badge>
    {/each}
  </div>
</div>
