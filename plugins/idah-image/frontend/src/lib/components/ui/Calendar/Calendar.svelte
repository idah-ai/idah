<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";

  let {
    value = $bindable(undefined),
    ...restProps
  }: CalendarPrimitive.RootProps & { [key: string]: unknown } = $props();
</script>

<CalendarPrimitive.Root
  bind:value={value as any}
  {...restProps}
/>
