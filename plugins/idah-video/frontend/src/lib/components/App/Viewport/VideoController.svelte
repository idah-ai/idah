<script lang="ts">
  import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    FastForwardIcon,
    PauseIcon,
    PlayIcon,
    SquareSplitHorizontalIcon,
    Volume2Icon,
    VolumeXIcon,
  } from "@lucide/svelte";
  import { onMount } from "svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "$lib/components/ui/DropdownMenu";
  import NumberField from "$lib/components/ui/Forms/fields/input/NumberField.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import Slider from "$lib/components/ui/Slider/Slider.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Video from "./Video.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
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
  interface VideoSpeedMenuItem {
    label: string;
    value: number;
  }
  const videoSpeeds: VideoSpeedMenuItem[] = [
    { label: "0.25 X", value: 0.25 },
    { label: "0.5 X", value: 0.5 },
    { label: "1 X", value: 1 },
    { label: "1.25 X", value: 1.25 },
    { label: "1.5 X", value: 1.5 },
    { label: "2 X", value: 2 },
    { label: "3 X", value: 3 },
    { label: "5 X", value: 5 },
  ];
  let currentSpeed: number = $state(1);
  let frameStep = $state<number>(10);
  // Display value is 1-based (user-facing), internal currentFrame is 0-based.
  let frameInputValue = $state<number | null>(viewport.video.currentFrame.value + 1);

  let disabledSplitButton = $derived.by(() => {
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
    if (isNaN(value) || value < 1 || value > media.totalFrames) {
      frameInputValue = viewport.video.currentFrame.value + 1;
      return;
    }
    viewport.video.currentFrame.value = value - 1;
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    performSeek();
    (event.target as HTMLInputElement).blur();
  };

  const handleBlur = () => {
    performSeek();
  };

  function selectVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    if (video) video.playbackRate(currentSpeed);
  }

  function goFrame(direction: "prev" | "next", step: number = 1) {
    const delta = direction === "prev" ? -step : step;
    viewport.video.currentFrame.value = Math.max(
      0,
      Math.min(media.totalFrames - 1, viewport.video.currentFrame.value + delta),
    );
  }

  function gotoFrameStep(direction: "prev" | "next") {
    goFrame(direction, frameStep);
  }

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

    <!-- VIDEO::VOLUME -->
    <Popover>
      <PopoverTrigger>
        <Button variant="outline" size="icon-sm">
          {#if volume.muted || volume.level == 0}
            <VolumeXIcon />
          {:else}
            <Volume2Icon />
          {/if}
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="center" class="max-w-10 px-2">
        <Slider
          type="single"
          orientation="vertical"
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => video?.setVolume(v)}
          value={volume.level}
        />
      </PopoverContent>
    </Popover>

    <!-- VIDEO::SPEED -->
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm">
          <FastForwardIcon />
          {videoSpeeds.find((speed) => speed.value === currentSpeed)?.label || "Speed"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Video speed</DropdownMenuLabel>
          {#each videoSpeeds as { label, value } (value)}
            <DropdownMenuItem onclick={() => selectVideoSpeed(value)}>{label}</DropdownMenuItem>
          {/each}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- VIDEO::FRAME ADJUSTER -->
    <div class="inline-flex items-center gap-1 whitespace-nowrap">
      <NumberField
        name="frame-seek"
        class="min-w-24"
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
