<script lang="ts">
  import { viewport } from "$lib/plugin/video-annotation-activity/state/viewport.svelte";
  import { currentFrame, isVideoPlaying, totalFrames } from "$lib/plugin/video-annotation-activity/store/store";

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
    <pre class="debug-content">viewport.timeline.range {viewport.timeline.range.startRange.toFixed(1)} → {viewport.timeline.range.endRange.toFixed(1)}
viewport.currentFrame  {viewport.currentFrame.value}
currentFrame (legacy)  {$currentFrame}
totalFrames            {$totalFrames}
isVideoPlaying         {$isVideoPlaying}
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
</style>
