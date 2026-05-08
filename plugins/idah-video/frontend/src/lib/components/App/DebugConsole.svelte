<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";

  let visible = $state(false);

  function toggle() {
    visible = !visible;
  }

  $effect(() => {
    if (typeof window === "undefined") return;

    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "~") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    }

    // Use capture phase to run before the parent plugin handler
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });
</script>

{#if visible}
  <div class="debug-console">
    <button class="debug-close" onclick={() => (visible = false)}>✕</button>
    <pre class="debug-content"><span class="section">── TIMELINE ──</span>
range      {viewport.timeline.range.startRange.toFixed(1)} → {viewport.timeline.range.endRange.toFixed(1)}
dimensions {viewport.timeline.dimensions[0]} × {viewport.timeline.dimensions[1]} px

<span class="section">── WORKSPACE ──</span>
dimensions {viewport.workspace.dimensions[0]} × {viewport.workspace.dimensions[1]} px
--viewport [{ viewport.workspace.viewportSize[0] } × {viewport.workspace.viewportSize[1]}] - { viewport.workspace.viewportSize[2] } × {viewport.workspace.viewportSize[3]}
transform  translate({viewport.workspace.transform.translate[0].toFixed(1)}, {viewport.workspace.transform.translate[1].toFixed(1)}) scale({viewport.workspace.transform.scale.toFixed(2)})

<span class="section">── VIDEO ──</span>
frame      {viewport.video.currentFrame.value}
status     {viewport.video.status}
mode       {viewport.mode}
total      {media.totalFrames}
playing    {viewport.video.status === "play"}
</pre>
  </div>
{/if}

<style>
  .debug-console {
    position: fixed;
    z-index: 9999;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.82);
    color: #0f0;
    font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 10px 12px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    max-width: 420px;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    pointer-events: auto;
  }

  .debug-close {
    position: absolute;
    top: 2px;
    right: 4px;
    background: none;
    border: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .debug-close:hover {
    color: #fff;
  }

  .debug-content {
    margin: 0;
    padding: 0;
  }

  .debug-content .section {
    color: #4fc3f7;
    font-weight: bold;
    display: block;
    margin-top: 4px;
  }

  .debug-content .section:first-child {
    margin-top: 0;
  }
</style>
