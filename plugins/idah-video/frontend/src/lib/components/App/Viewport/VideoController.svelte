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

  import NumberField from "$lib/components/ui/Forms/fields/input/NumberField.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "$lib/components/ui/DropdownMenu";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import Slider from "$lib/components/ui/Slider/Slider.svelte";
  import Video from "./Video.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { getDriver } from "$lib/state/driver.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
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
  let currentSpeed: number = $state(1);
  let frameStep = $state<number>(10);
  let frameInputValue = $state<number>(viewport.video.currentFrame.value);

  let disabledSplitButton = $derived.by(() => {
    const ann =
      selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined;
    if (!ann) return true;
    if (ann.locked) return true;
    if (ann.shape?.end < viewport.video.currentFrame.value) return true;
  });

  // Sync frameInputValue with viewport.video.currentFrame when it changes externally
  $effect(() => {
    frameInputValue = viewport.video.currentFrame.value;
  });

  // TODO: @audi ideally, these should call commands ?

  // Functions
  const performSeek = (value: string) => {
    if (!value || value === "") return;

    const frameNumber = Number(value);

    // Validate frame number
    if (isNaN(frameNumber) || frameNumber < 1 || frameNumber > media.totalFrames) {
      return;
    }

    viewport.video.currentFrame.value = frameNumber;
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    // Only trigger on Enter key
    if (event.key !== "Enter") return;

    const target = event.target as HTMLInputElement;
    performSeek(target.value);

    // Blur the input after seeking
    target.blur();
  };

  const handleBlur = (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
    const target = event.currentTarget;
    performSeek(target.value);
  };

  function selectVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    if (video) video.playbackRate(currentSpeed);
  }

  function goFrame(direction: "prev" | "next", step: number = 1) {
    const delta = direction === "prev" ? -step : step;
    viewport.video.currentFrame.value = Math.max(1, Math.min(media.totalFrames, viewport.video.currentFrame.value + delta));
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
    <ToolTooltip
      label="Previous frame"
      shortcut={cmdShortcut("viewport.previous_frame")}
    >
      {#snippet trigger()}
        <Button variant="outline" size="icon-sm" onclick={() => getDriver().command.call("viewport.previous_frame")}>
          <ChevronLeftIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <!-- VIDEO::PLAY / PAUSE -->
    <ToolTooltip
      label={viewport.video.status === "play" ? "Pause" : "Play"}
      shortcut={cmdShortcut("viewport.play")}
    >
      {#snippet trigger()}
        <Button
          variant="outline"
          size="icon-sm"
          onclick={() => getDriver().command.call("viewport.play")}
        >
          {#if viewport.video.status === "play"}
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
      shortcut={cmdShortcut("viewport.next_frame")}
    >
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
        max={Math.max(0, media.totalFrames)}
        suffix={`/ ${Math.max(0, media.totalFrames)}`}
        bind:value={frameInputValue}
        onkeyup={handleKeyUp}
        onblur={handleBlur}
        groupInputClass="h-7"
      />
    </div>

    <!-- ANNOTATION::SPLIT -->
    <ToolTooltip
      label="Split annotation"
    >
      {#snippet trigger()}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabledSplitButton}
          onclick={() => {
            const ann =
              selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined;
            if (ann)
              context.commands.run("annotation.split", {
                id: ann.metadata?.id ?? ann.id,
                at: viewport.video.currentFrame.value,
              }
            );
          }}
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
