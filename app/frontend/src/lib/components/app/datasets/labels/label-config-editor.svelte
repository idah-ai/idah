<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  import type { LabelConfigurations, LabelConfigurationValue } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    labelConfig: LabelConfigurations;
    onAddCategory: (labelConfigKey: string, nodeId?: string) => void;
    onEditCategoryId: (labelConfigKey: string, oldId: string, newId: string) => void;
    onEditCategory: (labelConfigKey: string, category: LabelConfigurationValue) => void;
    onRemoveCategory: (labelConfigKey: string, categoryId: string) => void;
  }
  let { labelConfig, onAddCategory, onEditCategoryId, onEditCategory, onRemoveCategory }: Props = $props();

  // Variables
  let selectedConfigKey: string = $state(Object.keys(labelConfig)[0]);
  let hasAtLeastOneCategory: boolean = $derived(labelConfig[selectedConfigKey].values.length > 0);
  let hasAtLeastOneProperty: boolean = $derived(labelConfig[selectedConfigKey].properties.length > 0);

  // Functions
  function selectConfigKey(key: string) {
    selectedConfigKey = key;
  }

  function addCategory(nodeId?: string) {
    onAddCategory(selectedConfigKey, nodeId);
  }

  function editCategoryId(oldId: string, newId: string) {
    onEditCategoryId(selectedConfigKey, oldId, newId);
  }

  function editCategory(editedCategory: LabelConfigurationValue) {
    onEditCategory(selectedConfigKey, editedCategory);
  }

  function removeCategory(categoryId: string) {
    onRemoveCategory(selectedConfigKey, categoryId);
  }
</script>

<section class="flex w-full flex-col gap-2 lg:flex-row">
  <!-- LABEL CONFIG::NAVIGATION -->
  <div class="flex w-full lg:min-w-72 lg:max-w-80">
    <Card class="w-full gap-2">
      <CardHeader>
        <CardTitle>Configurations</CardTitle>
        <CardDescription class="text-xs">Select a labelConfiguration to manage</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#each Object.keys(labelConfig) as labelConfigKey (labelConfigKey)}
          {@const isSelect = selectedConfigKey === labelConfigKey}
          <Button
            variant={isSelect ? "default" : "secondary"}
            class="w-full justify-start"
            onclick={() => selectConfigKey(labelConfigKey)}
          >
            {labelConfigKey}
          </Button>
        {/each}
      </CardContent>
    </Card>
  </div>

  <!-- LABEL CONFIG::CATEGORIES & PROPERTIES -->
  <div class="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-5">
    <!-- CATEGORIES -->
    <Card class="col-span-1 gap-2 lg:col-span-3">
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription class="text-xs">
          Manage the categories for the "{selectedConfigKey}" label configuration
        </CardDescription>

        <CardAction>
          {#if hasAtLeastOneCategory}
            <Button size="sm" onclick={() => addCategory()}>
              <PlusIcon />
              New Category
            </Button>
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent>
        <CategoryTree
          values={labelConfig[selectedConfigKey].values}
          onAddCategory={(nodeId) => addCategory(nodeId)}
          onEditCategoryId={(oldId, newId) => editCategoryId(oldId, newId)}
          onEditCategory={(editedCategory) => editCategory(editedCategory)}
          onRemoveCategory={(categoryId) => removeCategory(categoryId)}
        />
      </CardContent>
    </Card>

    <!-- PROPERTIES -->
    <Card class="col-span-1 gap-2 md:col-span-2">
      <CardHeader>
        <CardTitle>Properties</CardTitle>
        <CardDescription class="text-xs">Manage the properties</CardDescription>

        <CardAction>
          {#if hasAtLeastOneProperty}
            <Button size="sm">
              <PlusIcon />
              New Property
            </Button>
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent></CardContent>
    </Card>
  </div>
</section>
