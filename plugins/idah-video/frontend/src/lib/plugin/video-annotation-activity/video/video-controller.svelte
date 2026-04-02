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
  import { getContext } from "svelte";
  import type { ChangeEventHandler } from "svelte/elements";

  import NumberField from "$lib/components/app/forms/fields/input/number-field.svelte";
  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu";
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
  let sliderValue: number = $derived(max - (zoom - min));
  let disabledSplitButton = $derived.by(() => {
    if (!$selectedAnnotation) return true;
    if ($selectedAnnotation.locked) return true;
    if ($selectedAnnotation.shape.end < $currentFrame) return true;
  });

  const seekToFrame: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    const { value } = target;
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
    let frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP) || 10);

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
</script>

<div id="video-controller" class="flex w-full items-center justify-between gap-4">
  <!-- CONTAINER::LEFT -->
  <div class="flex items-center gap-2">
    <!-- VIDEO::PREVIOUS FRAME STEP -->
    <Button variant="outline" size="icon-sm" onclick={() => gotoFrameStep("prev")}>
      <ChevronsLeftIcon />
    </Button>

    <!-- VIDEO::PREVIOUS FRAME -->
    <Button variant="outline" size="icon-sm" onclick={() => video.previousFrame()}>
      <ChevronLeftIcon />
    </Button>

    <!-- VIDEO::PLAY / PAUSE -->
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

    <!-- VIDEO::NEXT FRAME -->
    <Button variant="outline" size="icon-sm" onclick={() => video.nextFrame()}>
      <ChevronRightIcon />
    </Button>

    <!-- VIDEO::NEXT FRAME STEP -->
    <Button variant="outline" size="icon-sm" onclick={() => gotoFrameStep("next")}>
      <ChevronsRightIcon />
    </Button>

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
    <Tooltips>
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
      {#snippet content()}
        Split annotation
      {/snippet}
    </Tooltips>
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
