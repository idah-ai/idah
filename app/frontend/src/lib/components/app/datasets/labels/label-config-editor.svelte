<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  import type { LabelConfigurations } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    labelConfig: LabelConfigurations;
  }
  let { labelConfig }: Props = $props();

  // Variables
  let selectedConfigKey: string = $state(Object.keys(labelConfig)[0]);
  let hasAtLeastOneCategory: boolean = $derived(labelConfig[selectedConfigKey].values.length > 0);
  let hasAtLeastOneProperty: boolean = $derived(labelConfig[selectedConfigKey].properties.length > 0);

  // Functions
  function selectConfigKey(key: string) {
    selectedConfigKey = key;
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
            <Button size="sm">
              <PlusIcon />
              New Category
            </Button>
          {/if}
        </CardAction>
      </CardHeader>

      <CardContent>
        <CategoryTree values={labelConfig[selectedConfigKey].values} />
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
