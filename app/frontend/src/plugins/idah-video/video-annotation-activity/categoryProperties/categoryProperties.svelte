<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import SelectGroup from "@/components/ui/select/select-group.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { getContext } from "svelte";

  import { visibilityFullfilled } from ".";
  import { idb_updated_at } from "../idb_store.svelte";
  import BooleanProperty from "./properties/booleanProperty.svelte";
  import IntegerProperty from "./properties/integerProperty.svelte";
  import TextProperty from "./properties/textProperty.svelte";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext, IConfigProperty } from "@/plugin/interface/Activity";
  import MultiSelectProperty from "./properties/MultiSelectProperty.svelte";
  import SingleSelectProperty from "./properties/SingleSelectProperty.svelte";

  type Props = {
    type: string;
    selectedCategory: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (id?: string) => void;
    onEditValue: (value?: AnnotationValue) => void;
    disabled: boolean;
  };

  let { type, selectedCategory, annotationValue, onSelectCategory, onEditValue, disabled }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");
  const typeConfig = context.config[type];
  const category = typeConfig?.values.find((c) => c.id == selectedCategory);
  const properties = typeConfig?.properties.filter((p) => visibilityFullfilled(annotationValue, p));
  const propertyComponents: {
    type: string;
    component:
      | typeof TextProperty
      | typeof IntegerProperty
      | typeof BooleanProperty
      | typeof SingleSelectProperty
      | typeof MultiSelectProperty;
  }[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    { type: "single-select", component: SingleSelectProperty },
    { type: "multi-select", component: MultiSelectProperty },
  ];

  function onValueChange(property: IConfigProperty, v: string | number | string[] | undefined | boolean) {
    const newValue = {
      ...annotationValue,
      attributes: {
        ...(annotationValue.attributes || {}),
        [property.id]: v,
      },
    };
    const new_visible_properties = typeConfig?.properties
      .filter((p) => visibilityFullfilled(newValue, p))
      .map((p) => p.id);
    const visibilityDiff = Object.keys(newValue.attributes).filter((k) => !new_visible_properties.includes(k));
    // remove visibility false properties
    if (visibilityDiff.length) visibilityDiff.forEach((p) => delete newValue.attributes?.[p]);
    onEditValue(newValue);
  }
</script>

<div>
  <div class="flex pb-1">
    <Text class="text-muted-foreground" weight="medium" size="xs"
      >{((s: string) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""))(
        type.split(":").reverse()[0].split(new RegExp(/-|_/)).join(" "),
      )}</Text
    >
  </div>
  {#key $idb_updated_at}
    <Select type="single" onValueChange={onSelectCategory} {disabled}>
      <SelectTrigger class="data-[placeholder]:text-secondary-foreground bg-secondary w-full truncate text-xs">
        <div class="flex gap-1">
          {#if category?.label}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <!-- prettier-ignore -->
              <path
        d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
        stroke={category.color || "var(--color-gray-500)"}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
            </svg>
            {category.label}
          {:else}
            Select category
          {/if}
        </div>
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {#each typeConfig.values as c (c.id)}
            <SelectItem value={c.id} label={c.label} class="text-xs">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <!-- prettier-ignore -->
                <path
        d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
        stroke={c.color || "var(--color-gray-500)"}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
              </svg>
              {c.label}
            </SelectItem>
          {/each}
        </SelectGroup>
      </SelectContent>
    </Select>

    <hr class="my-3 border-t border-gray-200" />

    {#if category && properties?.length > 0}
      <div class="flex pb-1">
        <Text class="text-muted-foreground" weight="medium" size="xs">Properties</Text>
      </div>

      {#each properties as property (property.id)}
        {@const pc = propertyComponents.find((p) => p.type == property.type)}

        {#if pc}
          <div class="flex flex-col gap-2">
            <pc.component
              {...{
                property,
                value: annotationValue.attributes?.[property.id],
                onValueChange: (v: string | number | boolean | string[] | undefined) => onValueChange(property, v),
                disabled,
              }}
            />
          </div>
        {/if}
      {/each}
    {/if}
  {/key}
</div>
