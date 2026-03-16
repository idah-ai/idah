import BooleanProperty from "$lib/components/app/sidebar/properties/boolean-property.svelte";
import IntegerProperty from "$lib/components/app/sidebar/properties/integer-property.svelte";
import MultiSelectProperty from "$lib/components/app/sidebar/properties/multi-select-property.svelte";
import SingleSelectProperty from "$lib/components/app/sidebar/properties/single-select-property.svelte";
import TextProperty from "$lib/components/app/sidebar/properties/text-property.svelte";

export interface PropertyComponent {
  type: string;
  component:
    | typeof TextProperty
    | typeof IntegerProperty
    | typeof BooleanProperty
    | typeof SingleSelectProperty
    | typeof MultiSelectProperty;
}
