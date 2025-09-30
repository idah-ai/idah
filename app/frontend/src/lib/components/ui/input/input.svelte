<script lang="ts">
  import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type InputType = Exclude<HTMLInputTypeAttribute, "file">;

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type"> &
      (
        | { type: "file"; files?: FileList }
        | {
            type?: InputType;
            files?: undefined;
          }
      ) & {
        prefix?: string;
        suffix?: string;
      }
  >;

  let {
    ref = $bindable(null),
    value = $bindable(),
    type,
    files = $bindable(),
    prefix = undefined,
    suffix = undefined,
    class: className,
    ...restProps
  }: Props = $props();
</script>

<div
  class={cn(
    "bg-background border-input ring-offset-background focus-within:ring-ring gap-none flex w-full items-center rounded-md border shadow-sm focus-within:ring-1 focus-within:outline-none",
    className,
  )}
>
  {#if prefix}
    <span class="text-muted-foreground pointer-events-none flex items-center pl-3 text-sm">{prefix}</span>
  {/if}

  <input
    bind:this={ref}
    data-slot="input"
    class="placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
    {type}
    bind:value
    {...restProps}
  />

  {#if suffix}
    <span class="text-muted-foreground pointer-events-none flex min-w-fit items-center pr-3 text-sm">{suffix}</span>
  {/if}
</div>
