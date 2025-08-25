<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import * as Menubar from "$lib/components/ui/menubar/index";
  import MenubarLabel from "@/components/ui/menubar/menubar-label.svelte";
  import MenubarTrigger from "@/components/ui/menubar/menubar-trigger.svelte";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import Slider from "@/components/ui/slider/slider.svelte";
  import { Switch } from "@/components/ui/switch";
  import TimelineTable from "./timeline-table/timeline-table.svelte";

  import { type VideoAnnotation } from "@/components/video-annotation-activity/VideoAnnotationContext";

  let {
    onPreviousFrame,
    onTogglePlay,
    onNextFrame,
    onToggleMute,
    onSeekFrame,
    currentFrame,
    totalFrames,
    volume = $bindable(),
    onSetVolume,
    annotations,
    selectedAnnotation,
    onSelectAnnotation,
    onDeleteAnnotation,
  }: {
    onPreviousFrame: () => void;
    onTogglePlay: () => void;
    onNextFrame: () => void;
    onToggleMute: () => void;
    currentFrame: number;
    totalFrames: number;
    onSeekFrame: (frame: number) => void;
    volume: number;
    onSetVolume: (volume: number) => void;
    annotations: VideoAnnotation[];
    selectedAnnotation: VideoAnnotation | undefined;
    onSelectAnnotation: (annotations: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation, frame?: number) => void;
  } = $props();

  let timeline_table: TimelineTable;
  let timeline_zoom = $state(1);
  let scale = $state(100);
  let tracking = $state(false);
</script>

<Menubar.Root>
  <Menubar.Menu>
    <Button onclick={onPreviousFrame}>
      <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="fill-secondary"
          d="M15.1708 14.325L11.3458 10.5L15.1708 6.675L13.9958 5.5L8.99577 10.5L13.9958 15.5L15.1708 14.325ZM4.8291 5.5H6.49577V15.5H4.8291V5.5Z"
        />
      </svg>
    </Button>
    <Button onclick={onTogglePlay}>
      <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path class="fill-secondary" d="M5.41675 4.66667V16.3333L14.5834 10.5L5.41675 4.66667Z" />
      </svg>
    </Button>
    <Button onclick={onNextFrame}>
      <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="fill-secondary"
          d="M4.8291 6.675L8.6541 10.5L4.8291 14.325L6.0041 15.5L11.0041 10.5L6.0041 5.5L4.8291 6.675ZM13.5041 5.5H15.1708V15.5H13.5041V5.5Z"
        />
      </svg>
    </Button>
  </Menubar.Menu>

  <Menubar.Menu>
    <MenubarTrigger>
      <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="fill-primary"
          d="M12.0833 7.85833V13.1417L10.275 11.3333H7.91667V9.66666H10.275L12.0833 7.85833ZM13.75 3.83333L9.58333 7.99999H6.25V13H9.58333L13.75 17.1667V3.83333Z"
        />
      </svg>
      <MenubarLabel>({volume}%)</MenubarLabel>
    </MenubarTrigger>
    <Menubar.Content>
      <Menubar.Item>
        <Slider type="single" min={0} max={100} step={1} value={volume} onValueChange={onSetVolume} />
      </Menubar.Item>
    </Menubar.Content>
  </Menubar.Menu>
  <Menubar.Menu>
    <MenubarLabel>frame:</MenubarLabel>
    <Input
      type="number"
      min={0}
      max={Math.max(0, totalFrames - 1)}
      value={currentFrame}
      oninputcapture={(e) => {
        const v = Math.min(Math.max(0, totalFrames - 1), parseInt(e.target.value) || 0);
        onSeekFrame(v);
        // timeline_table.setOffset(v - Math.floor(((scale * timeline_zoom) / 2)))
      }}
      onchange={console.log}
    />/{Math.max(0, totalFrames - 1)}
  </Menubar.Menu>
  <Button>
    <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        class="fill-secondary"
        d="M0.25 10.75C0.25 14.8917 3.60833 18.25 7.75 18.25C9.21667 18.25 10.5833 17.825 11.7417 17.1L10.525 15.8833C9.7 16.325 8.75 16.5833 7.75 16.5833C4.53333 16.5833 1.91667 13.9667 1.91667 10.75C1.91667 7.53333 4.53333 4.91667 7.75 4.91667H7.89167L6.575 6.24167L7.75 7.41667L11.0833 4.08333L7.75 0.75L6.56667 1.925L7.89167 3.25H7.75C3.60833 3.25 0.25 6.60833 0.25 10.75ZM7.75 10.75L12.75 15.75L17.75 10.75L12.75 5.75L7.75 10.75ZM12.75 13.3917L10.1083 10.75L12.75 8.10833L15.3917 10.75L12.75 13.3917Z"
      />
    </svg>
  </Button>
  <Button
    onclick={() => {
      if (!selectedAnnotation) return;
      onDeleteAnnotation(selectedAnnotation, currentFrame);
    }}
  >
    <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        class="fill-secondary"
        d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"
      />
    </svg>
  </Button>
  <Menubar.Menu>
    <MenubarLabel>
      scale {scale}
    </MenubarLabel>
    <Slider
      type="single"
      min={20}
      max={150}
      step={1}
      value={scale}
      onValueChange={(value) => timeline_table.setScale(value)}
    />
  </Menubar.Menu>
  <Switch bind:checked={tracking} />
  <Input
    type="number"
    min={1}
    max={Math.ceil(totalFrames / scale)}
    value={timeline_zoom}
    oninput={(e) => {
      timeline_table.setTimelineZoom(parseInt(e.target.value) || 0);
    }}
  />
</Menubar.Root>
<ScrollArea class="h-[calc(100%-2.5em)]">
  <TimelineTable
    bind:this={timeline_table}
    {tracking}
    {currentFrame}
    {totalFrames}
    {annotations}
    {selectedAnnotation}
    {onSeekFrame}
    {onDeleteAnnotation}
    {onSelectAnnotation}
    onScaleChange={(s) => (scale = s)}
    onTimelineZoomChange={(z) => (timeline_zoom = z)}
  />
</ScrollArea>
