<script lang="ts">
  import { BoltIcon, PlusIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import PropertyCard from "@/components/app/datasets/labels/cards/property-card.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";

  import { slugify } from "@/utils/string";

  import type { LabelingConfiguration, PropertyField } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    onSetProperty: (property: PropertyField) => void;
    onRemoveProperty: (propertyId: string) => void;
  }
  let { onSetProperty, onRemoveProperty }: Props = $props();

  // Contexts
  let labelConfig = getContext("labelConfig") as LabelingConfiguration;

  // Functions
  function addNewProperty() {
    const propertyExists = labelConfig.properties && labelConfig.properties.length > 0;
    const newPropertyLabel: string = `Property ${propertyExists ? labelConfig.properties.length + 1 : 1}`;

    onSetProperty({
      id: slugify(newPropertyLabel),
      label: newPropertyLabel,
      type: "text",
      description: "",
      required: false,
      format: {
        minimum: null,
        maximum: null,
        step: 1,
        info: null,
        options: [],
      },
      selector: [],
    });
  }
</script>

{#snippet AddNewPropertyButton()}
  <Button onclick={addNewProperty}>
    <PlusIcon class="size-4"></PlusIcon>
    New Property
  </Button>
{/snippet}

<div class="flex flex-col gap-4">
  {#each labelConfig.properties as property, index (index)}
    <PropertyCard {property} {onSetProperty} {onRemoveProperty}></PropertyCard>
  {:else}
    <Card>
      <CardContent>
        <ResponseBlock icon={BoltIcon} title="No Properties Yet" description="Create properties to get started">
          {#snippet actions()}
            {@render AddNewPropertyButton()}
          {/snippet}
        </ResponseBlock>
      </CardContent>
    </Card>
  {/each}

  {#if labelConfig.properties.length > 0}
    {@render AddNewPropertyButton()}
  {/if}
</div>
