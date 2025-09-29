<script lang="ts">
  import { setContext } from "svelte";

  import LabelTree from "@/components/app/datasets/labels/trees/label-tree.svelte";
  import PropertiesManagement from "@/components/app/datasets/labels/properties-management.svelte";
  import TagsManagement from "@/components/app/datasets/labels/tags-management.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Text from "@/components/ui/text/Text.svelte";

  import {
    type CategoryField,
    type LabelingConfiguration,
    type PropertyField,
    type TagField,
  } from "@/data/model/dataset/labels";
  import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

  // Props
  interface Props {
    labelConfig: LabelingConfiguration | undefined;

    // Category
    onAddCategory: (nodeId?: string) => void;
    onEditCategory: (category: CategoryField) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onRemoveCategory: (categoryId: string) => void;

    // Property
    onSetProperty: (property: PropertyField) => void;
    onRemoveProperty: (propertyId: string) => void;

    // Tag
    onSetTag: (tag: TagField) => void;
    onRemoveTag: (tagId: string) => void;
  }
  let {
    labelConfig,

    // Category
    onAddCategory,
    onEditCategory,
    onEditCategoryId,
    onRemoveCategory,

    // Property
    onSetProperty,
    onRemoveProperty,

    // Tag
    onSetTag,
    onRemoveTag,
  }: Props = $props();

  // Contexts
  setContext("labelConfig", labelConfig);

  // Variables
  type Tab = "properties" | "taggings";
  const tabs: BaseTabs<Tab> = [
    { label: "Properties", value: "properties" },
    { label: "Taggings", value: "taggings" },
  ];
  let currentTab: Tab = $state("properties");
</script>

<div class="grid grid-cols-1 gap-8 pt-4 md:grid-cols-6">
  <div class="col-span-1 flex flex-col gap-4 md:col-span-4">
    <Text size="h2" weight="semibold">Categories</Text>

    <LabelTree {onAddCategory} {onEditCategory} {onEditCategoryId} {onRemoveCategory}></LabelTree>
  </div>

  <div class="col-span-1 flex flex-col gap-4 md:col-span-2">
    <Tabs bind:value={currentTab}>
      <TabsList class="w-full">
        {#each tabs as { label, value } (value)}
          <TabsTrigger {value}>{label}</TabsTrigger>
        {/each}
      </TabsList>

      <TabsContent value="properties">
        <PropertiesManagement {onSetProperty} {onRemoveProperty}></PropertiesManagement>
      </TabsContent>

      <TabsContent value="taggings">
        <TagsManagement {onSetTag} {onRemoveTag}></TagsManagement>
      </TabsContent>
    </Tabs>
  </div>
</div>
