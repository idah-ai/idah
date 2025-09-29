<script lang="ts">
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";

  import { cn } from "@/utils";

  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";

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
  <Checkbox {name} {disabled} {readonly} {required} bind:checked {onCheckedChange} />

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
