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
  import { getContext, onMount } from "svelte";
  import type { ChangeEventHandler } from "svelte/elements";

  import NumberField from "$lib/components/app/forms/fields/input/number-field.svelte";
  import ToolTooltip from "$lib/components/app/tooltips/tool-tooltip.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu";
  import { getShortcut } from "$lib/components/ui/kbd/utils";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
  import Slider from "$lib/components/ui/slider/slider.svelte";
  import Video from "$lib/plugin/video-annotation-activity/video/video.svelte";

  import { IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP } from "$lib/plugin/type";
  import {
    currentFrame,
    isVideoPlaying,
    selectedAnnotation,
    totalFrames,
  } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    setCurrentFrameRange,
    timelineCellWidth,
    timelineRulerWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  import type { IActivityContext } from "$idah/context/activity-context";

  // Props
  interface Props {
    video: Video;
    volume: { level: number; muted: boolean };
    zoom: number;
    // onZoomChange: (zoom: number) => void;
  }
  let { video = $bindable(), volume, zoom }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

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
  const min = 20;
  const max = 150;

  let currentSpeed: number = $state(1);
  let frameStep = $state<number>(10);
  let sliderValue: number = $derived(max - (zoom - min));
  let disabledSplitButton = $derived.by(() => {
    if (!$selectedAnnotation) return true;
    if ($selectedAnnotation.locked) return true;
    if ($selectedAnnotation.shape.end < $currentFrame) return true;
  });

  // TODO: ideally, these should call commands ?

  // Functions
  const seekToFrame: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    const { value } = target;

    /** If value is out of current frame range, set a new frame range */
    const [startFrameIndexOfCurrentFrameRange, endFrameIndexOfCurrentFrameRange] = $currentFrameRange;
    const rulerScale = Math.floor($timelineRulerWidth / $timelineCellWidth);
    const halfOfRulerScale = Math.floor(rulerScale / 2) * $framePerScale;

    if (Number(value) >= endFrameIndexOfCurrentFrameRange || Number(value) <= startFrameIndexOfCurrentFrameRange) {
      const newStart = Math.max((Number(value) - halfOfRulerScale) / $framePerScale, 0);
      const newEnd = Math.max((Number(value) + halfOfRulerScale) / $framePerScale, rulerScale);
      setCurrentFrameRange([newStart, newEnd]);
    }

    video.seekToFrame(Number(value));
  };

  function selectVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    video.playbackRate(currentSpeed);
  }

  // function onSliderChange(value: number): void {
  //   zoom = max - (value - min); // flip value
  //   // onZoomChange(zoom);
  // }

  // function zoomIn(): void {
  //   zoom = zoom - 5;
  //   // onZoomChange(Math.min(max, zoom + 1));
  // }

  // function zoomOut(): void {
  //   zoom = zoom + 5;
  //   // onZoomChange(Math.max(min, zoom - 1));
  // }

  function gotoFrameStep(direction: "prev" | "next") {
    switch (direction) {
      case "prev": {
        video.previousFrame(frameStep);
        break;
      }
      case "next": {
        video.nextFrame(frameStep);
        break;
      }
    }
  }

  function getFrameStepFromLocalStorage() {
    const localStorageFrameStep = localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP);

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
      shortcut={getShortcut(context.shortcutReferences?.["player.previous_multiple_frames"].keyCombinations)}
      onOpenChange={fetchFrameStepFromLocalStorage}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => gotoFrameStep("prev")}>
          <ChevronsLeftIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PREVIOUS FRAME -->
    <ToolTooltip
      label="Previous frame"
      shortcut={getShortcut(context.shortcutReferences?.["player.previous_frame"].keyCombinations)}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => video.previousFrame()}>
          <ChevronLeftIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PLAY / PAUSE -->
    <ToolTooltip
      label={$isVideoPlaying ? "Pause" : "Play"}
      shortcut={getShortcut(context.shortcutReferences?.["player.toggle_play"].keyCombinations)}
    >
      {#snippet trigger()}
        <Button
          variant="outline"
          size="icon-sm"
          onclick={() => {
            video.togglePlay();
          }}
        >
          {#if $isVideoPlaying}
            <PauseIcon />
          {:else}
            <PlayIcon />
          {/if}
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::NEXT FRAME -->
    <ToolTooltip
      label="Next frame"
      shortcut={getShortcut(context.shortcutReferences?.["player.next_frame"].keyCombinations)}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => video.nextFrame()}>
          <ChevronRightIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::NEXT FRAME STEP -->
    <ToolTooltip
      label={`Next ${frameStep} frames`}
      shortcut={getShortcut(context.shortcutReferences?.["player.next_multiple_frames"].keyCombinations)}
      onOpenChange={fetchFrameStepFromLocalStorage}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => gotoFrameStep("next")}>
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
          min={1}
          max={100}
          step={1}
          onValueChange={video.setVolume}
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

      <DropdownMenuContent>
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
        max={Math.max(0, $totalFrames)}
        suffix={`/ ${Math.max(0, $totalFrames)}`}
        value={$currentFrame}
        oninput={seekToFrame}
        groupInputClass="h-7"
      />
    </div>

    <!-- ANNOTATION::SPLIT -->
    <ToolTooltip
      label="Split annotation"
      shortcut={getShortcut(context.shortcutReferences?.["selected.split"].keyCombinations)}
    >
      {#snippet trigger()}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabledSplitButton}
          onclick={() =>
            $selectedAnnotation &&
            context.commands.run("annotation.split", {
              id: $selectedAnnotation.metadata.id,
              at: $currentFrame,
            })}
        >
          <SquareSplitHorizontalIcon />
        </Button>
      {/snippet}
    </ToolTooltip>
  </div>

  <!-- CONTAINER::CENTER -->
  <!-- <Button variant="outline" class="border-primary text-primary hover:text-primary">Auto Track</Button> -->

  <!-- CONTAINER::RIGHT -->
  <!-- <div class="flex items-center gap-2">
    <Tooltips align="center">
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={zoomOut}>
          <ZoomOutIcon />
        </Button>
      {/snippet}

      {#snippet content()}
        Zoom out
      {/snippet}
    </Tooltips>

    <Slider class="min-w-[200px]" type="single" {min} {max} step={5} value={sliderValue} onValueChange={onSliderChange}
    ></Slider>

    <Tooltips align="center">
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={zoomIn}>
          <ZoomInIcon />
        </Button>
      {/snippet}

      {#snippet content()}
        Zoom in
      {/snippet}
    </Tooltips>
  </div> -->

  <!-- VIDEO::SCALE ADJUSTER (SCALE DOWN / SCALE UP) -->
  <!-- <Popover>
      <PopoverTrigger>
        <Tooltips align="center">
          {#snippet trigger()}
            <Button variant="outline" size="icon-sm">
              <RulerIcon />
            </Button>
          {/snippet}

          {#snippet content()}
            Zoom scale
          {/snippet}
        </Tooltips>
      </PopoverTrigger>

      <PopoverContent side="top" align="center" class="flex max-w-10 flex-col items-center gap-2 px-2">
        <Text class="text-muted-foreground">{scale}</Text>

        <Slider
          type="single"
          orientation="vertical"
          min={1}
          max={Math.ceil(totalFrames / zoom)}
          step={1}
          value={scale}
          onValueChange={onScaleChange}
        />
      </PopoverContent>
    </Popover> -->
</div>
