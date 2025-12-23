<script lang="ts">
  import type { Snippet } from "svelte";

  import ColorPicker from "@/components/app/color-picker/color-picker.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";

  // Props
  interface Props extends FormFieldBaseProps {
    value: string | null | undefined;
    onValueChange?: (value: string | null | undefined) => void;
    slotSuggestion?: Snippet;
  }
  let {
    name,
    label,
    required = false,
    disabled = false,
    value = $bindable(null),
    info,
    errors,
    class: className,
    slotLabel,
    slotInfo,
    slotErrors,
    onValueChange,
    slotSuggestion,
  }: Props = $props();

  // Variables
  let colorFormat = $derived("hex");

  // Functions
  function handleValueChange(newValue: string | null | undefined, newColorFormat: string) {    
    colorFormat = newColorFormat;
    
    onValueChange?.(newValue);
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
        <div class="flex w-full items-center gap-2">
          <Button
            variant="outline"
            class={cn("justify-start text-left font-normal", {
              "text-muted-foreground": !value,
            })}
            style="background-color: {value || 'transparent'};"
            {disabled}
            {...props}
          ></Button>

          {#if value}
            <Text size="sm" weight="semibold" class="text-muted-foreground">{colorFormat.toUpperCase()}</Text>

            <Text size="sm" weight="semibold">{value}</Text>
          {/if}
        </div>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0" side="right">
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
