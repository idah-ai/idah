<script lang="ts">
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

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
      "hover:bg-accent/50 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/10 dark:has-[[data-state=checked]]:border-primary/90 dark:has-[[data-state=checked]]:bg-primary/90 rounded-lg border p-3":
        bordered,
    },
    className,
  )}
>
  <Switch {name} {disabled} {required} bind:checked {onCheckedChange}></Switch>

  <div class="grid flex-1 gap-1.5 font-normal">
    {#if slotLabel}
      {@render slotLabel()}
    {:else}
      <FormFieldLabel {required} class={checked ? "text-accent-foreground" : undefined}>{label}</FormFieldLabel>
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
