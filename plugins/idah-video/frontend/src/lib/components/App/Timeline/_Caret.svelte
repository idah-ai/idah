<script lang="ts">
  interface Props {
    x: number;
    value: number;
    labelFormatter?: (value: number) => string;
    height: number;
    color?: string;
    showLine?: boolean;
    showLabel?: boolean;
  }

  let {
    x,
    value,
    labelFormatter = (v: number) => String(Math.floor(v)),
    height,
    color = "#ccc",
    showLine = true,
    showLabel = true,
  }: Props = $props();
</script>

<div class="caret" style="left: {x}px; height: {height}px;">
  {#if showLine}
    <div class="caret-line" style="background-color: {color};"></div>
  {/if}
  {#if showLabel}
    <div class="caret-label" style="border-color: {color}; color: {color};">{labelFormatter(value)}</div>
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
    background-color: #fff;
    border: 1px solid;
    padding: 2px 6px;
    font-size: 11px;
    font-family: sans-serif;
    white-space: nowrap;
    border-radius: 3px;
  }
</style>
