<script lang="ts">
  import {
    ChevronFirstIcon,
    ChevronLastIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    PauseIcon,
    PlayIcon,
    SquareSplitHorizontalIcon,
  } from "@lucide/svelte";
  import { onMount } from "svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";
  import NumberField from "$lib/components/ui/Forms/fields/input/NumberField.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";
  import VideoSettingsDropdownMenu from "$lib/components/App/Viewport/VideoSettingsDropdownMenu.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";

  function cmdShortcut(name: string): string | undefined {
    const s = getDriver().command.getShortcut(name);
    return s ? getShortcutLabel(s) : undefined;
  }

  // Props
  interface Props {
    video: Video | undefined;
    volume: { level: number; muted: boolean };
  }
  let { video = $bindable(), volume }: Props = $props();

  // Variables
  let frameStep = $state<number>(10);
  // Display value is 1-based (user-facing), internal currentFrame is 0-based.
  let frameInputValue = $state<number | null>(viewport.video.currentFrame.value + 1);

  let disabledSplitButton = $derived.by(() => {
    if (!isEditable()) return true;
    const ann = selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined;
    if (!ann) return true;
    if (annotation.isLocked(ann)) return true;
    if (ann.shape?.end < viewport.video.currentFrame.value) return true;
  });

  // Sync frameInputValue from currentFrame (0→1 for display)
  $effect(() => {
    frameInputValue = viewport.video.currentFrame.value + 1;
  });

  // Functions
  const handleInput = (e: Event) => {
    const rawValue = (e.target as HTMLInputElement).value;
    frameInputValue = rawValue === "" ? null : Number(rawValue);
  };

  const performSeek = () => {
    let value = frameInputValue;
    // Empty input defaults to frame 1
    if (value === null || value === undefined) {
      value = 1;
      frameInputValue = 1;
    }
    if (isNaN(value)) {
      frameInputValue = viewport.video.currentFrame.value + 1;
      return;
    }
    // Clamp to valid range [1, media.totalFrames]
    value = Math.max(1, Math.min(media.totalFrames, value));
    frameInputValue = value;
    viewport.video.goToFrame(value - 1);
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    performSeek();
    (event.target as HTMLInputElement).blur();
  };

  const handleBlur = () => {
    performSeek();
  };

  function getFrameStepFromLocalStorage() {
    const localStorageFrameStep = localStorage.getItem("idah-video:settings:frame-step");

    if (localStorageFrameStep) {
      frameStep = Number(localStorageFrameStep);
    }
  }

  function fetchFrameStepFromLocalStorage(open: boolean) {
    if (!open) return;
    getFrameStepFromLocalStorage();
  }

  // Lifecycles
  onMount(getFrameStepFromLocalStorage);
</script>

<div id="video-controller" class="flex w-full items-center justify-between gap-4">
  <!-- CONTAINER::LEFT -->
  <div class="flex items-center gap-2">
    <!-- VIDEO::FIRST FRAME -->
    <ToolTooltip label="First frame" shortcut={cmdShortcut("timeline.go_to_first")}>
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("timeline.go_to_first")}>
          <ChevronFirstIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PREVIOUS FRAME STEP -->
    <ToolTooltip
      label={`Previous ${frameStep} frames`}
      shortcut={cmdShortcut("viewport.skip_backward")}
      onOpenChange={fetchFrameStepFromLocalStorage}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.skip_backward")}>
          <ChevronsLeftIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PREVIOUS FRAME -->
    <ToolTooltip label="Previous frame" shortcut={cmdShortcut("viewport.previous_frame")}>
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.previous_frame")}>
          <ChevronLeftIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PLAY / PAUSE -->
    <ToolTooltip label={viewport.video.status === "play" ? "Pause" : "Play"} shortcut={cmdShortcut("viewport.play")}>
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.play")}>
          {#if viewport.video.status === "play"}
            <PauseIcon />
          {:else}
            <PlayIcon />
          {/if}
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::NEXT FRAME -->
    <ToolTooltip label="Next frame" shortcut={cmdShortcut("viewport.next_frame")}>
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.next_frame")}>
          <ChevronRightIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::NEXT FRAME STEP -->
    <ToolTooltip
      label={`Next ${frameStep} frames`}
      shortcut={cmdShortcut("viewport.skip_forward")}
      onOpenChange={fetchFrameStepFromLocalStorage}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.skip_forward")}>
          <ChevronsRightIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::LAST FRAME -->
    <ToolTooltip label="Last frame" shortcut={cmdShortcut("timeline.go_to_last")}>
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("timeline.go_to_last")}>
          <ChevronLastIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <VideoSettingsDropdownMenu bind:video {volume} />

    <!-- VIDEO::FRAME ADJUSTER -->
    <div class="inline-flex w-40 items-center gap-1 whitespace-nowrap">
      <NumberField
        name="frame-seek"
        placeholder="Frame"
        min={1}
        suffix={`/ ${Math.max(0, media.totalFrames)}`}
        value={frameInputValue}
        oninput={handleInput}
        onkeyup={handleKeyUp}
        onblur={handleBlur}
        groupInputClass="h-7"
      />
    </div>

    <!-- ANNOTATION::SPLIT -->
    <ToolTooltip label="Split annotation" shortcut={cmdShortcut("annotation.split")}>
      {#snippet trigger()}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabledSplitButton}
          onclick={() => {
            const ann = selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined;
            if (ann)
              getDriver().command.call("annotation.split", {
                annotationId: ann.metadata?.id ?? ann.id,
                at: viewport.video.currentFrame.value,
              });
          }}
        >
          <SquareSplitHorizontalIcon />
        </Button>
      {/snippet}
    </ToolTooltip>
  </div>
</div>
