<script lang="ts">
  import type { Snippet } from "svelte";

  import ColorPicker from "@/components/app/color-picker/color-picker.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";

  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";

  // Props
  interface Props extends FormFieldBaseProps {
    value: string | null | undefined;
    onValueChanged?: (value: string | null | undefined) => void;
    slotSuggestion?: Snippet;
  }
  let {
    name,
    label,
    placeholder = "Select a color",
    required = false,
    disabled = false,
    value = $bindable(null),
    info,
    errors,
    class: className,
    slotLabel,
    slotInfo,
    slotErrors,
    onValueChanged,
    slotSuggestion
  }: Props = $props();

  // Variables

  // Functions
 function handleValueChange(value: string | null | undefined) {
    onValueChanged?.(value);
  }
</script>

<FormField id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FormFieldLabel {required}>{label}</FormFieldLabel>
  {/if}

  <Popover>
    <PopoverTrigger>
      {#snippet child({ props })}
        <Button
          variant="outline"
          class={cn("w-full justify-start text-left font-normal", {
            "text-muted-foreground": !value,
          })}
          {disabled}
          {...props}
        >
          {value ? value : placeholder}
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0" align="start" side="right">
      <ColorPicker bind:value onValueChange={handleValueChange} {slotSuggestion}></ColorPicker>
    </PopoverContent>
  </Popover>

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
