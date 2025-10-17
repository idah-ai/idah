<script lang="ts">
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import { propertyFullfilled } from "..";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let { property, value, onValueChange }: { property: PropertyField; value: any; onValueChange: (v: any) => void } =
    $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
</script>

<div class="my-2 flex flex-col gap-1">
  <div class="flex items-center space-x-2 text-center">
    <Label for={property.id}>
      {property.label}
    </Label>

    <Switch aria-invalid={invalid} id={property.id} checked={!!value} onCheckedChange={onValueChange} />
  </div>

  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color="red">{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
