<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import CategoryTree from "@/components/app/datasets/labels/categories/category-tree.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  import type { Hash } from "@/utils/types";

  // Variables
  const config: Hash = {
    "idah-video:bounding_box": {
      values: [
        { id: "vehicle/car", label: "Car" },
        { id: "vehicle/truck", label: "Truck" },
        { id: "vehicle/bike", label: "Bike" },
        { id: "vehicle/other", label: "Other" },
        { id: "person/adult", label: "Adult" },
        { id: "person/child", label: "Child" },
      ],
      properties: [
        {
          id: "brand",
          label: "Brand",
          type: "text",
          required: true,
          visibility: ["match", ["get", "value.id"], "vehicle/*"],
          format: {
            min: 1,
            max: 100,
          },
        },
        {
          id: "age",
          label: "Age",
          type: "integer",
          visibility: ["match", ["get", "value.id"], "person/*"],
          required: true,
          format: {
            min: 1,
          },
        },
      ],
    },
    "idah-video:polygon_box": {
      values: [
        { id: "vehicle/car", label: "Car" },
        { id: "vehicle/truck", label: "Truck" },
        { id: "vehicle/bike", label: "Bike" },
        { id: "vehicle/other", label: "Other" },
        { id: "person/adult", label: "Adult" },
        { id: "person/child", label: "Child" },
      ],
      properties: [
        {
          id: "brand",
          label: "Brand",
          type: "text",
          required: true,
          visibility: ["match", ["get", "value.id"], "vehicles/*"],
          format: {
            min: 1,
            max: 100,
          },
        },
        {
          id: "age",
          label: "Age",
          type: "integer",
          visibility: ["match", ["get", "value.id"], "person/*"],
          required: true,
          format: {
            min: 1,
          },
        },
      ],
    },
    "idah-video:framed_tag": {
      values: [
        { id: "accident", label: "Accident" },
        { id: "traffic", label: "Traffic" },
      ],
      properties: [
        {
          id: "entity_concerned",
          label: "visible number of entity impacted",
          type: "integer",
          visibility: ["match", ["get", "value.id"], "*"],
        },
        {
          id: "rightofway",
          label: "Right of way",
          type: "single-select",
          visibility: ["eq", ["get", "value.id"], "traffic"],
          required: true,
          format: {
            options: [
              { id: "row.vehicle", label: "Vehicle" },
              { id: "row.pedestrian", label: "Pedestrian" },
            ],
          },
        },
      ],
    },
    "idah-video:ranged_tag": {
      values: [
        { id: "accident", label: "Accident" },
        { id: "traffic", label: "Traffic" },
      ],
      properties: [
        {
          id: "entity_concerned",
          label: "visible number of entity impacted",
          type: "integer",
          visibility: ["match", ["get", "value.id"], "*"],
        },
        {
          id: "rightofway",
          label: "Right of way",
          type: "single-select",
          visibility: ["eq", ["get", "value.id"], "traffic"],
          required: true,
          format: {
            options: [
              { id: "row.vehicle", label: "Vehicle" },
              { id: "row.pedestrian", label: "Pedestrian" },
            ],
          },
        },
      ],
    },
    "entry:root": {
      values: [
        // in case of entry:root I'm assuming those should be either unique or exclusive
        // { id: "entry:root", label: "Unique Entry Annotation" },
      ],
      properties: [
        // any configuration of properties or none :) ..
      ],
    },
  };
  let selectedConfigKey: string = $state(Object.keys(config)[0]);
  let hasAtLeastOneCategory: boolean = $derived(config[selectedConfigKey].values.length > 0);
  let hasAtLeastOneProperty: boolean = $derived(config[selectedConfigKey].properties.length > 0);

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
        <CardDescription class="text-xs">Select a configuration to manage</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-2">
        {#each Object.keys(config) as configKey (configKey)}
          {@const isSelect = selectedConfigKey === configKey}
          <Button
            variant={isSelect ? "default" : "secondary"}
            class="w-full justify-start"
            onclick={() => selectConfigKey(configKey)}
          >
            {configKey}
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
        <CategoryTree values={config[selectedConfigKey].values} />
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
