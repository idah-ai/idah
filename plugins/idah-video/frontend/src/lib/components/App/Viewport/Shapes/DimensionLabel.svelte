<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";

  type Props = {
    /** Pixel x-position (top-left corner). */
    x: number;
    /** Pixel y-position (top-left corner). */
    y: number;
    /** Dimension text to display (e.g. "1920 × 1080"). */
    text: string;
  };

  let { x, y, text }: Props = $props();

  let invScale = $derived(1 / viewport.workspace.transform.scale);
</script>

<g
  transform="translate({x}, {y - 6 * invScale}) scale({invScale})"
  style:pointer-events="none"
  style:user-select="none"
>
  <text
    x={0}
    y={0}
    style:font-size="12px"
    style:font-weight="bold"
    style:fill="#fff"
    style:text-anchor="start"
    style:dominant-baseline="auto"
    style:paint-order="stroke"
    style:stroke="rgba(0, 0, 0, 0.85)"
    style:stroke-width="3px"
    style:stroke-linecap="round"
    style:stroke-linejoin="round"
  >{text}</text>
</g>