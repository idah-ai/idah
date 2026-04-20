<script lang="ts">
  import { InfoIcon } from "@lucide/svelte";
  import type { HTMLInputTypeAttribute } from "svelte/elements";
  import type { Snippet } from "svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
  } from "$lib/components/ui/field";
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
  } from "$lib/components/ui/input-group";

  import { cn } from "$lib/utils";

  import type { InputFieldBaseProps } from "$lib/components/app/forms/form-field.types";

  // Props
  interface Props extends Omit<InputFieldBaseProps, "suffixIcon"> {
    type?: HTMLInputTypeAttribute;
    value: string | null | undefined;
    suffixIcon?: Snippet;
    children?: Snippet;
  }
  let {
    value = $bindable(null),
    prefix = undefined,
    prefixIcon: PrefixIcon = undefined,
    suffix = undefined,
    suffixIcon = undefined,
    oninput = undefined,
    onblur = undefined,
    name,
    type = "text",
    label,
    placeholder,
    disabled = false,
    required = false,
    readonly,
    description,
    info,
    errors,
    class: className,
    slotDescription,
    slotErrors,
    children,
  }: Props = $props();
</script>

<Field class={cn("", className)}>
  <FieldLabel for={name} {required}>{label}</FieldLabel>

  <InputGroup>
    {#if PrefixIcon}
      <InputGroupAddon align="inline-start">
        <PrefixIcon />
      </InputGroupAddon>
    {/if}

    {#if prefix}
      <InputGroupAddon align="inline-start">
        <InputGroupText>{prefix}</InputGroupText>
      </InputGroupAddon>
    {/if}

    <InputGroupInput
      id={name}
      aria-invalid={errors ? "true" : "false"}
      {type}
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {value}
      {oninput}
      {onblur}
    />

    {#if suffix}
      <InputGroupAddon align="inline-end">
        <InputGroupText>{suffix}</InputGroupText>
      </InputGroupAddon>
    {/if}

    {#if suffixIcon}
      <InputGroupAddon align="inline-end">
        {@render suffixIcon()}
      </InputGroupAddon>
    {/if}

    {#if info}
      <InputGroupAddon align="inline-end">
        <Tooltips align="center">
          {#snippet trigger()}
            <InputGroupButton variant="ghost" size="icon-xs">
              <InfoIcon />
            </InputGroupButton>
          {/snippet}

          {#snippet content()}
            {info}
          {/snippet}
        </Tooltips>
      </InputGroupAddon>
    {/if}
  </InputGroup>

  {#if slotDescription}
    {@render slotDescription()}
  {:else if description}
    <FieldDescription>{description}</FieldDescription>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else if errors}
    <FieldError>{errors}</FieldError>
  {/if}
</Field>
