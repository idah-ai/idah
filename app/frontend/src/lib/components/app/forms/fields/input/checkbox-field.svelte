<script lang="ts">
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";

  import { cn } from "@/utils";

  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";

  // Props
  interface Props extends FormFieldBaseProps {
    bordered?: boolean;
    checkboxClass?: string;
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
  let {
    bordered = false,
    checkboxClass,
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

  // The checkbox renders a <button role="checkbox"> (not a native input),
  // so clicking the <label> won't toggle it automatically. Forward the click
  // to the checkbox so label clicks behave exactly like checkbox clicks.
  let checkboxRef = $state<HTMLButtonElement | null>(null);

  function handleLabelClick() {
    checkboxRef?.click();
  }
</script>

<FormField
  id={name}
  class={cn(
    "flex flex-row items-center gap-3",
    {
      "hover:bg-accent/50 has-[[aria-checked=true]]:border-primary/60 has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary/90 dark:has-[[aria-checked=true]]:bg-primary/90 rounded-lg border p-3":
        bordered,
      "items-start": slotInfo || info,
    },
    className,
  )}
>
  <Checkbox
    bind:ref={checkboxRef}
    class={checkboxClass}
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
      <FormFieldLabel {required} onclick={handleLabelClick}>{label}</FormFieldLabel>
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
