<script lang="ts">
  import { getContext } from "svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import CheckboxField from "@/components/app/forms/fields/input/checkbox-field.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Input from "@/components/ui/input/input.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { constructTree, type TreeItem } from "@/data/model/dataset/dataset-record";
  import {
    CheckIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronsUpDownIcon,
    PlusIcon,
    Trash2Icon,
  } from "@lucide/svelte";

  import {
    labelPropertyTypes,
    type LabelingConfiguration,
    type LabelPropertyConfiguration,
    type LabelPropertyType,
  } from "@/data/model/dataset/types";
  import type { Hash } from "@/utils/types";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  // Props
  interface Props {
    property: LabelPropertyConfiguration;
    onSetProperty: (property: LabelPropertyConfiguration) => void;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { property, onSetProperty, onRemoveProperty }: Props = $props();

  // Contexts
  let labelConfig = getContext("labelConfig") as LabelingConfiguration;

  // Variables
  let { id, description, label, format, required, type, selector } = $derived(property);
  let showContent: boolean = $state(true);
  let openAssignCategory: boolean = $state(false);
  let editingLabel: boolean = $state(false);
  let treeItems = $derived(constructTree(labelConfig));

  let selectedType: LabelPropertyType | undefined = $derived(labelPropertyTypes.find((t) => t.value === property.type));

  // Functions
  function toggleContent() {
    showContent = !showContent;
  }

  function setProperty(valueToSet: Hash) {
    onSetProperty({ ...property, ...valueToSet });
  }

  function assignCategory(params: { categoryId: string; isLastNode: boolean }) {
    const { categoryId, isLastNode } = params;
    const assigningSelectorId: string = isLastNode ? categoryId : `${categoryId}/*`;

    if (isLastNode) {
      /**
       * If the assigning selector is a last node,
       * Check each selector if there is any parent selector already exists,
       * If there is, remove the parent selector and add the last node selector,
       * If there is none, just add the last node selector.
       */
      const parentSelectors = selector.filter(
        (s) => assigningSelectorId.startsWith(s.split("/*")[0]) && s !== assigningSelectorId,
      );
      if (parentSelectors.length) {
        setProperty({
          selector: [...selector.filter((s) => !parentSelectors.includes(s)), assigningSelectorId],
        });
      } else if (!selector.includes(assigningSelectorId)) {
        // If not selected, add it
        setProperty({ selector: [...(selector || []), assigningSelectorId] });
      } else {
        // If already selected, remove it
        setProperty({
          selector: selector.filter((s) => s !== assigningSelectorId),
        });
      }
    } else {
      /**
       * If the assigning selector is not a last node,
       * Check if there are any children related to the selected category,
       * If there are, remove the children and add the selected category,
       * If there are none, just add the selected category.
       */
      const childSelectors = selector.filter((s) => s.startsWith(categoryId + "/") || s === categoryId);

      // Check if the selected category already exists in the selector
      const selectedCategoryExists = selector.includes(assigningSelectorId);

      if (selectedCategoryExists) {
        // If already selected, remove it
        setProperty({
          selector: selector.filter((s) => s !== assigningSelectorId),
        });
      } else {
        // If not selected, add it and remove any child selectors
        setProperty({
          selector: [...selector.filter((s) => !childSelectors.includes(s)), assigningSelectorId],
        });
      }
    }
  }
</script>

<Card class="w-full">
  <!-- HEADER -->
  <CardHeader class="flex items-center gap-2">
    <!-- HEADER::TOGGLE SHOW CONTENT -->
    <Button variant="ghost" size="icon" onclick={toggleContent}>
      {#if showContent}
        <ChevronDownIcon class="size-4"></ChevronDownIcon>
      {:else}
        <ChevronRightIcon class="size-4"></ChevronRightIcon>
      {/if}
    </Button>

    <!-- HEADER::SELECT TYPE -->
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary" size="icon" class="cursor-pointer">
          {#if selectedType}
            {@const SelectedTypeIcon = selectedType.icon}
            <SelectedTypeIcon class="size-4"></SelectedTypeIcon>
          {/if}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuGroup>
          {#each labelPropertyTypes as { label, value, icon: Icon } (value)}
            <DropdownMenuItem onclick={() => setProperty({ type: value })}>
              <Icon class="size-4"></Icon>
              {label}
            </DropdownMenuItem>
          {/each}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- HEADER::TITLE -->
    <button class="cursor-text" onclick={() => (editingLabel = true)}>
      {#if editingLabel}
        <Input
          class="w-32"
          name="{property.id}/label"
          autofocus
          value={label}
          onblur={() => (editingLabel = false)}
          oninput={(e) => setProperty({ label: e.currentTarget.value })}
        ></Input>
      {:else if !label}
        <Text class="text-muted-foreground">No Label</Text>
      {:else}
        <CardTitle>{label}</CardTitle>
      {/if}
    </button>

    <div class="ml-auto flex items-center gap-2">
      <!-- HEADER::REQUIRED -->
      <CheckboxField
        name="{property.id}/required"
        label="Required"
        bordered={false}
        checked={required}
        onCheckedChange={() => setProperty({ required: !required })}
      ></CheckboxField>

      <!-- HEADER::REMOVE BUTTON -->
      <Button variant="ghost" size="icon" onclick={() => onRemoveProperty(property.id)}>
        <Trash2Icon class="size-4"></Trash2Icon>
      </Button>
    </div>
  </CardHeader>

  <!-- CONTENT -->
  {#if showContent}
    <CardContent>
      <div class="flex flex-col gap-4">
        <!-- CONTENT::DESCRIPTION -->
        <TextareaField
          name="{property.id}/description"
          label="Description"
          value={description}
          oninput={(e) => setProperty({ description: e.currentTarget.value })}
        ></TextareaField>

        <!-- CONTENT::OPTIONS -->
        <Text size="sm" class="text-muted-foreground">Options</Text>
        <div class="flex flex-col gap-2">
          {#if type === "text"}
            <!-- content here -->
          {:else if type === "integer"}
            <NumberField
              name="{property.id}/minimum"
              label="Minimum"
              placeholder="e.g. 0"
              value={format.minimum}
              oninput={(e) => setProperty({ format: { ...format, minimum: e.currentTarget.valueAsNumber } })}
            ></NumberField>
            <NumberField
              name="{property.id}/maximum"
              label="Maximum"
              placeholder="e.g. 100"
              value={format.maximum}
              oninput={(e) => setProperty({ format: { ...format, maximum: e.currentTarget.valueAsNumber } })}
            ></NumberField>
          {:else if type.includes("select")}
            {#each format.options as option, index (index)}
              <div class="flex items-center gap-2">
                <InputField
                  class="flex-1"
                  name="{property.id}/option_{index}"
                  placeholder="Option {index + 1}"
                  value={option}
                  oninput={(e) =>
                    setProperty({
                      format: {
                        ...format,
                        options: format.options.map((opt, i) => (i === index ? e.currentTarget.value : opt)),
                      },
                    })}
                ></InputField>
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={() =>
                    setProperty({ format: { ...format, options: format.options.filter((_, i) => i !== index) } })}
                >
                  <Trash2Icon class="size-4"></Trash2Icon>
                </Button>
              </div>
            {/each}

            <Button
              variant="outline"
              size="sm"
              onclick={() =>
                setProperty({
                  format: {
                    ...format,
                    options: [...(format.options || []), `Option ${(format.options || []).length + 1}`],
                  },
                })}
            >
              <PlusIcon class="size-4"></PlusIcon>
              Add Option
            </Button>
          {/if}
        </div>

        <Separator></Separator>

        <!-- CONTENT::SELECTORS -->
        <div class="flex items-center justify-between gap-4">
          <Text size="sm" class="text-muted-foreground">Assigned Categories</Text>

          <Popover bind:open={openAssignCategory}>
            <PopoverTrigger>
              <Badge class="rounded-lg">
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

              <div class="flex w-full flex-col">
                {#each treeItems as treeNode, index (index)}
                  {@render CategoryTreeNode({ node: treeNode, level: 1 })}
                {/each}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {#each selector as selector, index (index)}
            <Badge variant="outline" class="rounded-lg font-mono">{selector}</Badge>
          {/each}
        </div>
      </div>
    </CardContent>
  {/if}
</Card>

{#snippet CategoryTreeNode(props: { node: TreeItem; level: number })}
  {@const { node, level } = props}
  {@const marginLeft = `${(level - 1) * 1}rem`}
  <Button
    variant="ghost"
    class="hover:bg-primary/10 justify-start"
    onclick={() => assignCategory({ categoryId: node.id, isLastNode: node.children.length === 0 })}
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
    {#each node.children as child}
      {@const nextLevel = level + 1}
      {@render CategoryTreeNode({ node: child, level: nextLevel })}
    {/each}
  {/if}
{/snippet}
