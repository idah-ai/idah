<script lang="ts" module>
  import {
    CheckIcon,
    EllipsisVerticalIcon,
    LassoIcon,
    PlusIcon,
    SquareDashedMousePointerIcon,
    SquareIcon,
    Trash2Icon,
  } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import HoverCards from "@/components/app/hover-cards/hover-cards.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandGroup } from "@/components/ui/command";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Kbd } from "@/components/ui/kbd";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  import type { TreeItem } from "@/data/model/dataset/dataset-record";
  import { fieldTypes, labelColors, type CategoryField, type LabelingConfiguration } from "@/data/model/dataset/labels";

  interface TreeNodeProps {
    labelConfig: LabelingConfiguration;
    node: TreeItem;
    level: number;
    onAddCategory: (nodeId?: string) => void;
    onEditCategory: (category: CategoryField) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onRemoveCategory: (categoryId: string) => void;
  }

  // Variables
  const annotationTypes = [
    { label: "Bounding Box", value: "bounding_box", icon: SquareIcon },
    { label: "Polygon", value: "polygon", icon: LassoIcon },
  ];

  export { TreeNode };
</script>

{#snippet TreeNode(props: TreeNodeProps)}
  {@const { labelConfig, node, level, onAddCategory, onEditCategory, onEditCategoryId, onRemoveCategory } = props}
  {@const isLastNode = node.children.length === 0}
  {@const assignedProperties = labelConfig.properties.filter((property) =>
    property.selector.some((s) => node.id.startsWith(s.split("*")[0])),
  )}

  <div id={node.id} class={cn("flex items-center gap-2")} style:margin-left={`${(level - 1) * 3}rem`}>
    <!-- TREE::NODE -->
    <div class="border-border flex w-full items-center gap-2 rounded-lg border py-1 pr-2 pl-4">
      {#if isLastNode}
        <Popover>
          <PopoverTrigger>
            <Tooltips delayDuration={500}>
              {#snippet trigger()}
                <Button variant="ghost" class="cursor-pointer gap-4">
                  <div
                    class="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    style:background-color={node.color}
                    style:color={node?.text_color || "#FFFFFF"}
                  >
                    {#if node.type?.includes("bounding_box")}
                      <SquareDashedMousePointerIcon class="size-4"></SquareDashedMousePointerIcon>
                    {:else}
                      <LassoIcon class="size-4"></LassoIcon>
                    {/if}
                  </div>

                  <Kbd>⌘ {node.label.charAt(0)}</Kbd>

                  {node.label}
                </Button>
              {/snippet}

              {#snippet content()}
                Edit "{node.label}"
              {/snippet}
            </Tooltips>
          </PopoverTrigger>

          <PopoverContent align="center" side="right" class="p-0">
            <Command>
              <CommandGroup heading="Type">
                <SingleSelectField
                  name="{node.id}/type"
                  class="px-2"
                  choices={annotationTypes.map((t) => ({ label: t.label, value: t.value }))}
                  value={node.type.split(":")[1]}
                  onValueChange={(value) => {
                    onEditCategory({
                      id: node.id,
                      type: `${node.type.split(":")[0]}:${value}`,
                      color: node.color,
                      text_color: node.text_color,
                      label: node.label,
                    });
                  }}
                ></SingleSelectField>
              </CommandGroup>

              <CommandGroup heading="Shortcut Key"></CommandGroup>

              {@const idParts = node.id.split("/")}
              {@const parentParts = idParts.splice(0, idParts.length - 1)}
              {@const parentPath = parentParts.join("/")}
              <CommandGroup heading="ID">
                <InputField
                  name="{node.id}/id"
                  class="px-2"
                  prefix={parentPath ? `${parentPath}/` : ""}
                  value={idParts[idParts.length - 1]}
                  onblur={(e) => {
                    const value = e.currentTarget.value;
                    const newValue = parentPath ? `${parentPath}/${value}` : value;
                    onEditCategoryId(node.id, newValue);
                  }}
                ></InputField>
              </CommandGroup>

              <CommandGroup heading="Label">
                <InputField
                  name="{node.id}/label"
                  class="px-2"
                  value={node.label}
                  onblur={(e) => {
                    const value = e.currentTarget.value;

                    onEditCategory({
                      id: node.id,
                      type: node.type,
                      color: node.color,
                      text_color: node.text_color,
                      label: value,
                    });
                  }}
                ></InputField>
              </CommandGroup>

              <CommandGroup heading="Color">
                <div class="grid grid-cols-5 gap-1 px-2">
                  {#each labelColors as { label, color, text_color } (color)}
                    <Tooltips delayDuration={0}>
                      {#snippet trigger()}
                        <button
                          class="inline-flex size-6 items-center justify-center rounded-lg border"
                          style="background-color: {color}; color: {text_color}"
                          onclick={() =>
                            onEditCategory({
                              id: node.id,
                              type: node.type,
                              color: color,
                              text_color: text_color,
                              label: node.label,
                            })}
                        >
                          {#if node.color === color}
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
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      {:else}
        <Text size="sm" weight="semibold">{node.label}</Text>
      {/if}

      <div class="ml-auto flex items-center justify-end gap-2">
        <!-- ASSIGNED PROPERTIES::ONLY SHOW WHEN ASSIGNED -->
        {#if assignedProperties.length > 0}
          <HoverCards align="center" openDelay={200} contentClass="p-2">
            {#snippet trigger()}
              <Badge variant="outline" class="cursor-pointer">
                {assignedProperties.length > 1 ? `${assignedProperties.length} Properties` : "1 Property"}
              </Badge>
            {/snippet}

            {#snippet content()}
              <div class="flex flex-col gap-2">
                <Text size="sm" weight="semibold">Assigned Properties</Text>

                {#each assignedProperties as property (property.id)}
                  {@const fieldType = fieldTypes.find((type) => type.value === property.type)}
                  <div class="hover:bg-secondary flex items-center gap-2 rounded-md p-2">
                    {#if fieldType}
                      <fieldType.icon class="size-4"></fieldType.icon>
                    {/if}

                    <Text size="sm">{property.label}</Text>
                  </div>
                {/each}
              </div>
            {/snippet}
          </HoverCards>
        {/if}

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon">
              <EllipsisVerticalIcon class="size-4"></EllipsisVerticalIcon>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onclick={() => onAddCategory(node.id)}>
                <PlusIcon class="size-4"></PlusIcon>
                Add Sub-category
              </DropdownMenuItem>

              <DropdownMenuItem onclick={() => onRemoveCategory(node.id)}>
                <Trash2Icon class="size-4"></Trash2Icon>
                Remove
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </div>

  {#if node.children.length}
    {#each node.children as child (child.id)}
      {@const level = child.id.split("/").length}
      {@render TreeNode({
        labelConfig: props.labelConfig,
        node: child,
        level: level,
        onAddCategory: onAddCategory,
        onEditCategory: onEditCategory,
        onEditCategoryId: onEditCategoryId,
        onRemoveCategory: onRemoveCategory,
      })}
    {/each}
  {/if}
{/snippet}
