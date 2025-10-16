<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
  import Input from "@/components/ui/input/input.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { formatConformity, propertyFullfilled } from "..";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let { property, value, onValueChange }: { property: PropertyField; value: any; onValueChange: (v: any) => void } =
    $props();

  const invalid = $derived(!propertyFullfilled(value, property));

  const format = $derived(invalid ? formatConformity(value, property) : []);
</script>

<div class="my-2 flex flex-col gap-1">
  <Text class="text-gray-700" weight="medium" size="sm">{property.label}</Text>

  <Input type="text" aria-invalid={invalid} {value} onchange={(e) => onValueChange(e.target.value)} />
  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color="red">{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
