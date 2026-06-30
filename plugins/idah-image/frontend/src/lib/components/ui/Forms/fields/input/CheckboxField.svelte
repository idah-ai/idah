<script lang="ts">
  import FormFieldErrors from "$lib/components/ui/Forms/FormFieldErrors.svelte";
  import FormFieldInfo from "$lib/components/ui/Forms/FormFieldInfo.svelte";
  import FormFieldLabel from "$lib/components/ui/Forms/FormFieldLabel.svelte";
  import FormField from "$lib/components/ui/Forms/FormField.svelte";
  import Checkbox from "$lib/components/ui/Checkbox/Checkbox.svelte";

  import { cn } from "$lib/utils";

  import type { FormFieldBaseProps } from "$lib/components/ui/Forms/form-field.types";

  // Props
  interface Props extends FormFieldBaseProps {
    bordered?: boolean;
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
  let {
    bordered = false,
    checked = $bindable(false),
    onCheckedChange,
    name,
    label,
    disabled = false,
    required = false,
    readonly,
    info,
    errors,
    class: className,
    slotLabel,
    slotInfo,
    slotErrors,
  }: Props = $props();
</script>

<FormField
  id={name}
  class={cn(
    "flex flex-row items-start gap-3",
    {
      "hover:bg-accent/50 has-[[aria-checked=true]]:border-primary/60 has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/90 dark:has-[[aria-checked=true]]:bg-primary/90 rounded-lg border p-3":
        bordered,
    },
    className,
  )}
>
  <Checkbox
    {name}
    {disabled}
    {readonly}
    {required}
    bind:checked
    {onCheckedChange}
  ></Checkbox>

  <div class="grid flex-1 gap-1.5 font-normal">
    {#if slotLabel}
      {@render slotLabel()}
    {:else}
      <FormFieldLabel {required}>{label}</FormFieldLabel>
    {/if}

    {#if slotInfo}
      {@render slotInfo()}
    {:else if info}
      <FormFieldInfo>{info}</FormFieldInfo>
    {/if}

    {#if slotErrors}
      {@render slotErrors()}
    {:else if errors}
      <FormFieldErrors {errors}></FormFieldErrors>
    {/if}
  </div>
</FormField>
