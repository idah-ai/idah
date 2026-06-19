<script lang="ts">
  interface Props {
    value?: string | null;
    onValueChange?: (value: string | null) => void;
    [key: string]: unknown;
  }
  let { value = $bindable("#000000"), onValueChange, ...restProps }: Props = $props();
</script>

<div class="color-picker">
  <input
    type="color"
    bind:value
    oninput={() => onValueChange?.(value)}
    class="h-8 w-16 cursor-pointer rounded border"
    {...restProps}
  />
</div>
