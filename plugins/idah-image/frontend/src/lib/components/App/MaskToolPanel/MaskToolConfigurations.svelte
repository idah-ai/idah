<script lang="ts">
  // -------------------------------------------------------------------------
  // MaskToolConfigurations.svelte — Body of the floating panel for mask tools.
  //
  // No grip/drag here — FloatingToolPanel provides that. This reads and writes
  // `maskTool` directly; since it shares the plugin's Svelte runtime with the
  // canvas and the `[` / `]` shortcut commands, every edit stays in sync with
  // no cross-runtime bridging.
  // -------------------------------------------------------------------------
  import { Slider } from "$lib/components/ui/Slider";
  import { Switch } from "$lib/components/ui/Switch";
  import { maskTool } from "$lib/state/mask-tool.svelte";

  const MIN_RADIUS = 1;
  const MAX_RADIUS = 300;
</script>

<!-- Brush radius applies to the brush tool only; the polygon tool ignores it. -->
{#if maskTool.active === "brush"}
  <div class="flex items-center gap-2">
    <span class="text-muted-foreground text-xs whitespace-nowrap">Brush size</span>
    <Slider
      type="single"
      value={maskTool.brushRadius}
      min={MIN_RADIUS}
      max={MAX_RADIUS}
      step={1}
      class="w-40"
      onValueChange={(v: number) => (maskTool.brushRadius = v)}
    />
    <span class="text-foreground w-12 text-right text-xs tabular-nums">{maskTool.brushRadius} px</span>
  </div>

  <div class="bg-border h-6 w-px"></div>
{/if}

<label class="flex cursor-pointer items-center gap-2">
  <Switch checked={maskTool.preventOverlap} onCheckedChange={() => maskTool.togglePreventOverlap()} />
  <span class="text-muted-foreground text-xs whitespace-nowrap">Prevent overlap</span>
</label>
