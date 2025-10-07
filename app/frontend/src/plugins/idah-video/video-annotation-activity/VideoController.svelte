<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import {
    ChevronLeftIcon,
    ChevronRightIcon,
    FastForwardIcon,
    PauseIcon,
    PlayIcon,
    RulerIcon,
    Volume2Icon,
    VolumeXIcon,
    ZoomInIcon,
    ZoomOutIcon,
  } from "@lucide/svelte";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Slider from "@/components/ui/slider/slider.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";

  import type { ChangeEventHandler } from "svelte/elements";
  import Video from "./video.svelte";

  // Props
  interface Props {
    video: Video;
    currentFrame: number;
    totalFrames: number;
    scale: number;
    zoom: number;
    onZoomChange: (zoom: number) => void;
    onScaleChange: (scale: number) => void;
  }

  let { video = $bindable(), scale, zoom, currentFrame, totalFrames, onZoomChange, onScaleChange }: Props = $props();

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

  let volume: number = $state(50);
  let currentSpeed: number = $state(1);
  let isPlaying: boolean = $state(false);
  let isMuted: boolean = $derived(volume === 0);

  // Functions
  function setVolume(volumeToSet: number): void {
    video.setVolume(volumeToSet);
  }

  const seekToFrame: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    const { value } = target;
    video.seekToFrame(Number(value));
  };

  function selectVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    video.playbackRate(currentSpeed);
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
        isPlaying = !isPlaying;
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
          {#if isMuted}
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
          min={0}
          max={100}
          step={1}
          onValueChange={setVolume}
          bind:value={volume}
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
      <Input
        type="number"
        class="min-w-24"
        placeholder="Frame"
        min={0}
        max={Math.max(0, totalFrames - 1)}
        suffix={`/ ${Math.max(0, totalFrames - 1)}`}
        value={currentFrame}
        onchange={seekToFrame}
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
          <Button variant="outline" size="icon" onclick={() => onZoomChange(zoom - 1)}>
            <ZoomOutIcon class="size-4" />
          </Button>
        {/snippet}

        {#snippet content()}
          Zoom in
        {/snippet}
      </Tooltips>

      <Slider class="min-w-[200px]" type="single" min={20} max={150} step={1} value={zoom} onValueChange={onZoomChange}
      ></Slider>

      <Tooltips align="center">
        {#snippet trigger()}
          <Button variant="outline" size="icon" onclick={() => onZoomChange(zoom + 1)}>
            <ZoomInIcon class="size-4" />
          </Button>
        {/snippet}

        {#snippet content()}
          Zoom out
        {/snippet}
      </Tooltips>
    </div>

    <!-- VIDEO::SCALE ADJUSTER (SCALE DOWN / SCALE UP) -->
    <Popover>
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
    </Popover>
  </div>
</div>
