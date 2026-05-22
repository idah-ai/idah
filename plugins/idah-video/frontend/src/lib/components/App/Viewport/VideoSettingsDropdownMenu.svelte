<script lang="ts">
  import { ChevronsLeft, ChevronsRight, SettingsIcon } from "@lucide/svelte";

  import { Button } from "$lib/components/ui/Button";
  import { ButtonGroup } from "$lib/components/ui/ButtonGroup";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "$lib/components/ui/DropdownMenu";
  import NumberField from "$lib/components/ui/Forms/fields/input/NumberField.svelte";
  import { Slider } from "$lib/components/ui/Slider";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";

  import { ui } from "$lib/state/ui.svelte";

  // Props
  interface Props {
    video: Video | undefined;
    volume: { level: number; muted: boolean };
  }
  let { video = $bindable(), volume }: Props = $props();

  // Variables
  const availableSpeeds = [0.25, 0.5, 1.0, 2, 5];
  let currentSpeed = $state(1);
  let openVideoSettingDropdown = $state(false);

  // Functions
  function setVideoSpeed(selectedSpeed: number): void {
    currentSpeed = selectedSpeed;
    if (video) video.playbackRate(currentSpeed);
  }

  function setFrameStep(inputValue: number) {
    const minStep: number = 1;
    let stepToSet: number = inputValue;

    if (isNaN(inputValue)) stepToSet = minStep;
    if (stepToSet < minStep) stepToSet = minStep;
    ui.frameStep = stepToSet;
  }
</script>

<DropdownMenu bind:open={openVideoSettingDropdown}>
  <!-- PLAYBACK SPEED -->
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <ToolTooltip label="Video Settings" align="center" delayDuration={100}>
        {#snippet trigger()}
          <Button {...props} variant="outline" class="focus:outline-none" size="icon-sm">
            <SettingsIcon />
          </Button>
        {/snippet}
      </ToolTooltip>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent
    align="center"
    side="top"
    class="min-w-64"
    onCloseAutoFocus={(e) => {
      e.preventDefault();
      openVideoSettingDropdown = false;
    }}
  >
    <DropdownMenuLabel>Frame step</DropdownMenuLabel>
    <section class="flex flex-col gap-2 px-2 pb-2">
      <div class="text-muted-foreground text-sm">
        Set the number of frames to move <br />
        when clicking the
        <div class="inline-flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled>
            <ChevronsLeft />
          </Button>

          <span>or</span>

          <Button variant="outline" size="icon-sm" disabled>
            <ChevronsRight />
          </Button>
        </div>
        buttons<br />

        in the video player.
      </div>

      <NumberField
        name="settings/frame-step"
        placeholder="Frame step"
        min={1}
        value={ui.frameStep}
        oninput={(e) => setFrameStep(e.currentTarget.valueAsNumber)}
        onblur={(e) => setFrameStep(e.currentTarget.valueAsNumber)}
      />
    </section>

    <DropdownMenuSeparator />
    <DropdownMenuLabel>Playback speed</DropdownMenuLabel>
    <section class="flex flex-col gap-2 px-2 pb-2">
      <div class="flex flex-col items-center justify-center gap-4">
        <ButtonGroup class="w-full">
          {#each availableSpeeds as speed (speed)}
            <Button
              variant={speed === currentSpeed ? "default" : "outline"}
              size="sm"
              class="flex-1 focus:outline-none"
              onclick={() => setVideoSpeed(speed)}
            >
              {speed}X
            </Button>
          {/each}
        </ButtonGroup>
      </div>
    </section>

    <DropdownMenuSeparator />
    <DropdownMenuLabel>Volume: {volume.muted ? "Muted" : `${volume.level}%`}</DropdownMenuLabel>
    <section class="flex flex-col gap-2 px-2 pb-2">
      <Slider
        type="single"
        class="py-2"
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => video?.setVolume(v)}
        value={volume.level}
      />
    </section>
  </DropdownMenuContent>
</DropdownMenu>
