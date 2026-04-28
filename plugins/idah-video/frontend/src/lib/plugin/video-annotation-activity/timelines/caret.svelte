<script lang="ts">
  import { cn } from "$lib/utils";

  // Props
  interface Props {
    x: number;
    value: number;
    height: number;
    labelFormatter?: (value: number) => string;
    color: "primary" | "secondary";
    showLine?: boolean;
    showLabel?: boolean;
  }

  let {
    x,
    value,
    height,
    labelFormatter = (value: number) => String(Math.floor(value)),
    color,
    showLine = false,
    showLabel = false,
  }: Props = $props();

  // Variables
  let colorClass = $derived.by(() => {
    switch (color) {
      case "primary": {
        return "bg-primary text-primary-foreground border-primary";
      }
      case "secondary": {
        return "bg-secondary text-secondary-foreground border-1 border-secondary-foreground/50";
      }
    }
  });
</script>

<div class="caret" style:left="{x}px" style:height="{height}px">
  {#if showLine}
    <div class={cn("caret-line", colorClass)}></div>
  {/if}

  {#if showLabel}
    <div class={cn("caret-label", colorClass)}>
      {labelFormatter(value)}
    </div>
  {/if}
</div>

<style>
  .caret {
    position: absolute;
    top: 0;
    width: 2px;
    margin-left: -1px;
    z-index: 100;
    pointer-events: none;
    overflow: visible;
  }

  .caret-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 100%;
  }

  .caret-label {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 6px;
    font-size: 11px;
    font-family: sans-serif;
    white-space: nowrap;
    border-radius: 4px;
  }
</style>
