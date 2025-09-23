<script lang="ts">
  import { setContext } from "svelte";

  import LabelTree from "@/components/app/datasets/labels/trees/label-tree.svelte";
  import PropertiesManagement from "@/components/app/datasets/labels/properties-management.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import {
    type LabelCategoryConfiguration,
    type LabelingConfiguration,
    type LabelPropertyConfiguration,
  } from "@/data/model/dataset/types";

  // Props
  interface Props {
    labelConfig: LabelingConfiguration;
    onAddCategory: (nodeId?: string) => void;
    onEditCategory: (category: LabelCategoryConfiguration) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onRemoveCategory: (categoryId: string) => void;
    onSetProperty: (property: LabelPropertyConfiguration) => void;
    onRemoveProperty: (propertyId: string) => void;
  }
  let {
    labelConfig,
    onAddCategory,
    onEditCategory,
    onEditCategoryId,
    onRemoveCategory,
    onSetProperty,
    onRemoveProperty,
  }: Props = $props();

  // Contexts
  setContext("labelConfig", labelConfig);
</script>

<div class="grid grid-cols-1 gap-8 pt-4 md:grid-cols-6">
  <div class="col-span-1 flex flex-col gap-4 md:col-span-4">
    <Text size="h2" weight="semibold">Categories</Text>
    <LabelTree {onAddCategory} {onEditCategory} {onEditCategoryId} {onRemoveCategory}></LabelTree>
  </div>

  <div class="col-span-1 flex flex-col gap-4 md:col-span-2">
    <Text size="h2" weight="semibold">Properties</Text>

    <PropertiesManagement {onSetProperty} {onRemoveProperty}></PropertiesManagement>
  </div>
</div>
