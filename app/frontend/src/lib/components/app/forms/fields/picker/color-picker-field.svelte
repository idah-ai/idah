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

  // Functions
  function handleValueChange(newValue: string | null | undefined) {
    onValueChange?.(newValue);
  }

  function detectColorFormat(value: string): string {
    const v = value.trim().toLowerCase();

    // HEX
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) {
      return "HEX";
    }

    // RGB / RGBA
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(v)) {
      return "RGB";
    }

    // HSL / HSLA
    if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(v)) {
      return "HSL";
    }

    return "unknown";
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
            <Text size="sm" weight="semibold" class="text-muted-foreground">{detectColorFormat(value)}</Text>

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
