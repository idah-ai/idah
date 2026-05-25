<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from "bits-ui";
  let {
    ref = $bindable(null),
    checked = $bindable(false),
    disabled = false,
    ...restProps
  }: CheckboxPrimitive.RootProps & { disabled?: boolean } = $props();
</script>

<CheckboxPrimitive.Root
  bind:checked
  bind:ref
  {disabled}
  {...restProps}
>
  {#if checked === true}
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4">
      <path d="M5 12l5 5l10 -10" />
    </svg>
  {/if}
</CheckboxPrimitive.Root>
