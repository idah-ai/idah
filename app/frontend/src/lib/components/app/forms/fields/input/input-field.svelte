<script lang="ts">
  import FormField from "@/components/app/forms/form-field.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import Input from "@/components/ui/input/input.svelte";

  import { cn } from "@/utils";

  import type { FormEventHandler, HTMLInputTypeAttribute } from "svelte/elements";
  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";

  // Props
  interface Props extends FormFieldBaseProps {
    type?: HTMLInputTypeAttribute;
    value: string | null;
    prefix?: string;
    suffix?: string;
    oninput?: FormEventHandler<HTMLInputElement> | null | undefined;
    onblur?: FormEventHandler<HTMLInputElement> | null | undefined;
  }
  let {
    value = $bindable(null),
    prefix = undefined,
    suffix = undefined,
    oninput = undefined,
    onblur = undefined,
    name,
    type = "text",
    label,
    placeholder,
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

<FormField id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FormFieldLabel {required}>{label}</FormFieldLabel>
  {/if}

  <Input {name} {type} {placeholder} {disabled} {readonly} {required} {prefix} {suffix} bind:value {oninput} {onblur} />

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
