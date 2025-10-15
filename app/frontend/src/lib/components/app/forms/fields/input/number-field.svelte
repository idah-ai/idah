<script lang="ts">
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Input from "@/components/ui/input/input.svelte";

  import { cn } from "@/utils";

  import type { FormFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { FormEventHandler, HTMLInputTypeAttribute } from "svelte/elements";

  // Props
  interface Props extends FormFieldBaseProps {
    type?: HTMLInputTypeAttribute;
    value: number | null | undefined;
    oninput?: FormEventHandler<HTMLInputElement>;
  }
  let {
    value = $bindable(null),
    oninput,
    name,
    type = "number",
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

  <Input {name} {type} {placeholder} {disabled} {readonly} {required} bind:value {oninput}></Input>

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
