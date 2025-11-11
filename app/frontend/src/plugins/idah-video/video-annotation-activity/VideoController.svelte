<script lang="ts">
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Slider from "@/components/ui/slider/slider.svelte";
  import {
    ChevronLeftIcon,
    ChevronRightIcon,
    FastForwardIcon,
    PauseIcon,
    PlayIcon,
    Volume2Icon,
    VolumeXIcon,
    ZoomInIcon,
    ZoomOutIcon,
  } from "@lucide/svelte";

  import type { ChangeEventHandler } from "svelte/elements";
  import Video from "./video.svelte";

  // Props
  interface Props {
    video: Video;
    isPlaying: boolean;
    volume: { level: number; muted: boolean };
    currentFrame: number;
    totalFrames: number;
    scale: number;
    zoom: number;
    onZoomChange: (zoom: number) => void;
  }

  let { video = $bindable(), isPlaying, volume, zoom, currentFrame, totalFrames, onZoomChange }: Props = $props();

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

  const seekToFrame: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    const { value } = target;
    video.seekToFrame(Number(value));
  };

  function selectVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    video.playbackRate(currentSpeed);
  }

  function onSliderChange(value: number): void {
    zoom = max - (value - min); // flip value
    onZoomChange(zoom);
  }

  // Slider needs reversed value for displa

  function zoomIn(): void {
    zoom = zoom - 5;
    onZoomChange(Math.min(max, zoom + 1));
  }

  function zoomOut(): void {
    zoom = zoom + 5;

    onZoomChange(Math.max(min, zoom - 1));
  }
</script>

<div id="video-controller" class="flex w-full items-center justify-between gap-4">
  <!-- CONTAINER::LEFT -->
  <div class="flex items-center gap-2">
    <!-- VIDEO::PREVIOUS FRAME -->
    <Button variant="outline" size="icon" onclick={() => video.previousFrame()}>
      <ChevronLeftIcon class="size-4" />
    </Button>

    <!-- VIDEO::PLAY / PAUSE -->
    <Button
      variant="outline"
      size="icon"
      onclick={() => {
        video.togglePlay();
      }}
    >
      {#if isPlaying}
        <PauseIcon class="size-4" />
      {:else}
        <PlayIcon class="size-4" />
      {/if}
    </Button>

    <!-- VIDEO::NEXT FRAME -->
    <Button variant="outline" size="icon" onclick={() => video.nextFrame()}>
      <ChevronRightIcon class="size-4" />
    </Button>

    <!-- VIDEO::VOLUME -->
    <Popover>
      <PopoverTrigger>
        <Button variant="outline" size="icon">
          {#if volume.muted || volume.level == 0}
            <VolumeXIcon class="size-4" />
          {:else}
            <Volume2Icon class="size-4" />
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
        <Button variant="outline">
          <FastForwardIcon class="size-4" />
          {videoSpeeds.find((speed) => speed.value === currentSpeed)?.label || "Speed"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Video Speed</DropdownMenuLabel>
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
        max={Math.max(0, totalFrames)}
        suffix={`/ ${Math.max(0, totalFrames)}`}
        value={currentFrame}
        oninput={seekToFrame}
      />
    </div>
  </div>

  <!-- CONTAINER::CENTER -->
  <!-- <Button variant="outline" class="border-primary text-primary hover:text-primary">Auto Track</Button> -->

  <!-- CONTAINER::RIGHT -->
  <div class="flex items-center gap-2">
    <!-- VIDEO::ZOOM ADJUSTER (ZOOM IN / ZOOM OUT) -->
    <div class="flex items-center gap-2">
      <Tooltips align="center">
        {#snippet trigger()}
          <Button variant="outline" size="icon" onclick={zoomOut}>
            <ZoomOutIcon class="size-4" />
          </Button>
        {/snippet}

        {#snippet content()}
          Zoom out
        {/snippet}
      </Tooltips>

      <Slider
        class="min-w-[200px]"
        type="single"
        {min}
        {max}
        step={5}
        value={sliderValue}
        onValueChange={onSliderChange}
      ></Slider>

      <Tooltips align="center">
        {#snippet trigger()}
          <Button variant="outline" size="icon" onclick={zoomIn}>
            <ZoomInIcon class="size-4" />
          </Button>
        {/snippet}

        {#snippet content()}
          Zoom in
        {/snippet}
      </Tooltips>
    </div>
    <!-- VIDEO::SCALE ADJUSTER (SCALE DOWN / SCALE UP) -->
    <!-- <Popover>
      <PopoverTrigger>
        <Tooltips align="center">
          {#snippet trigger()}
            <Button variant="outline" size="icon">
              <RulerIcon class="size-4"></RulerIcon>
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
</div>
