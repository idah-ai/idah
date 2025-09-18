<script lang="ts" generics="T extends Record">
  import FormField from "@/components/app/forms/form-field.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";

  import { cn } from "@/utils";

  import type { SelectDataSourceFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { Record } from "@/data/model/Record";

  // Props
  interface Props extends SelectDataSourceFieldBaseProps<T> {
    values: Array<string | number | null>;
  }
  let {
    dataSource,
    listOptions,
    values = $bindable([]),
    name,
    label,
    placeholder = "Select an option",
    searchable = false,
    searchPlaceholder = "Search an option",
    clearable = false,
    disabled = false,
    required = false,
    info,
    errors,
    class: className,
    onValueChange,

    // Slots
    slotLabel,
    slotTrigger,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();
                                         
</script>

<FormField id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FormFieldLabel {required}>{label}</FormFieldLabel>
  {/if}

  {#if slotInfo}
    {@render slotInfo()}
  {:else}
    <FormFieldInfo>{info}</FormFieldInfo>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else}
    <FormFieldErrors {errors}></FormFieldErrors>
  {/if}
</FormField>
