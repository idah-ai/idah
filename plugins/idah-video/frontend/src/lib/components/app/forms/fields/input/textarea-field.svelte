<script lang="ts">
  import { InfoIcon } from "@lucide/svelte";

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
    InputGroupText,
    InputGroupTextarea,
  } from "$lib/components/ui/input-group";

  import { cn } from "$lib/utils";

  import type { TextAreaFieldBaseProps } from "$lib/components/app/forms/form-field.types";

  // Props
  interface Props extends TextAreaFieldBaseProps {
    value: string | null;
  }
  let {
    value = $bindable(null),
    prefix = undefined,
    prefixIcon: PrefixIcon = undefined,
    suffix = undefined,
    suffixIcon: SuffixIcon = undefined,
    oninput = undefined,
    onblur = undefined,
    name,
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

    <InputGroupTextarea
      id={name}
      aria-invalid={errors ? "true" : "false"}
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

    {#if SuffixIcon}
      <InputGroupAddon align="inline-end">
        <SuffixIcon />
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
