<script lang='ts'>
  import * as Table from "$lib/components/ui/table/index";
  import * as Menubar from "$lib/components/ui/menubar/index";
	import Slider from "$lib/components/ui/slider/slider.svelte";
	import Input from "../ui/input/input.svelte";
	import ScrollArea from "../ui/scroll-area/scroll-area.svelte";
	import { type VideoAnnotation } from "@/components/video-annotation-activity/VideoAnnotationContext";
	import Button from "../ui/button/button.svelte";
	import MenubarLabel from "../ui/menubar/menubar-label.svelte";
	import MenubarTrigger from "../ui/menubar/menubar-trigger.svelte";

  let {
    onPreviousFrame,
    onTogglePlay,
    onNextFrame,
    onToggleMute,
    onSeekFrame,
    current_frame,
    total_frames,
    volume = $bindable(),
    onSetVolume,
    annotations,
    selectedAnnotation,
    onSelectAnnotation,
    onDeleteAnnotation,
  }:{
    onPreviousFrame: () => void,
    onTogglePlay: () => void,
    onNextFrame: () => void,
    onToggleMute: () => void,
    current_frame:number,
    total_frames:number,
    onSeekFrame: (frame: number) => void,
    volume: number,
    onSetVolume: (volume: number) => void
    annotations: VideoAnnotation[],
    selectedAnnotation :VideoAnnotation|undefined,
    onSelectAnnotation: (annotations:VideoAnnotation) => void,
    onDeleteAnnotation: (annotation: VideoAnnotation, frame?: number) => void,
  } = $props()

  let range = $derived([0, total_frames || 0])
</script>

<div class="h-full">
  <div>
    <Menubar.Root>
      <Menubar.Menu>

        <Button onclick={onPreviousFrame}>
            <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class='fill-secondary' d="M15.1708 14.325L11.3458 10.5L15.1708 6.675L13.9958 5.5L8.99577 10.5L13.9958 15.5L15.1708 14.325ZM4.8291 5.5H6.49577V15.5H4.8291V5.5Z"/>
            </svg>
       </Button>
        <Button onclick={onTogglePlay}>
            <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class='fill-secondary' d="M5.41675 4.66667V16.3333L14.5834 10.5L5.41675 4.66667Z"/>
            </svg>
        </Button>
        <Button onclick={onNextFrame}>

            <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class='fill-secondary' d="M4.8291 6.675L8.6541 10.5L4.8291 14.325L6.0041 15.5L11.0041 10.5L6.0041 5.5L4.8291 6.675ZM13.5041 5.5H15.1708V15.5H13.5041V5.5Z"/>
            </svg>
        </Button>
      </Menubar.Menu>


      <Menubar.Menu>
          <MenubarTrigger>
              <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path class='fill-primary' d="M12.0833 7.85833V13.1417L10.275 11.3333H7.91667V9.66666H10.275L12.0833 7.85833ZM13.75 3.83333L9.58333 7.99999H6.25V13H9.58333L13.75 17.1667V3.83333Z"/>
              </svg>
              <MenubarLabel>({volume}%)</MenubarLabel>
          </MenubarTrigger>
          <Menubar.Content>
            <Menubar.Item>
                <Slider type='single' min={0} max={100} step={1} value={volume} onValueChange={onSetVolume}/>
            </Menubar.Item>
          </Menubar.Content>
      </Menubar.Menu>
      <Menubar.Menu>
        <MenubarLabel>
          frame:
        </MenubarLabel>
        <Input type="number" min={0} max={total_frames} value={current_frame} oninputcapture={(e) => {
          onSeekFrame(e.target.value)
        }}/>/{total_frames}
      </Menubar.Menu>
      <Button>
        <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path class='fill-secondary' d="M0.25 10.75C0.25 14.8917 3.60833 18.25 7.75 18.25C9.21667 18.25 10.5833 17.825 11.7417 17.1L10.525 15.8833C9.7 16.325 8.75 16.5833 7.75 16.5833C4.53333 16.5833 1.91667 13.9667 1.91667 10.75C1.91667 7.53333 4.53333 4.91667 7.75 4.91667H7.89167L6.575 6.24167L7.75 7.41667L11.0833 4.08333L7.75 0.75L6.56667 1.925L7.89167 3.25H7.75C3.60833 3.25 0.25 6.60833 0.25 10.75ZM7.75 10.75L12.75 15.75L17.75 10.75L12.75 5.75L7.75 10.75ZM12.75 13.3917L10.1083 10.75L12.75 8.10833L15.3917 10.75L12.75 13.3917Z"/>
        </svg>
      </Button>
      <!-- <Button onclick={() => {
          if (!selectedAnnotation) return console.warn('no selection to remove')

          let index = selectedAnnotation.shape.frames.findIndex((v) => v.frame == current_frame)
          if (index == -1) return console.warn('No frame to remove')
          let newframes = selectedAnnotation.shape.frames.filter((v) => v.frame != current_frame)
          selectedAnnotation.shape = {
            start: newframes.reduce((acc, v) => v.frame <= acc || acc == -1 ? v.frame : acc, -1),
            end: newframes.reduce((acc, v) => v.frame >= acc || acc == -1 ? v.frame : acc, -1),
            type: selectedAnnotation.shape.type,
            frames: newframes
          }
        }}>
          <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class='fill-secondary' d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"/>
          </svg>
      </Button> -->
            <Button onclick={() => {
            if (!selectedAnnotation) return
            onDeleteAnnotation(selectedAnnotation, current_frame)
          }}>
          <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class='fill-secondary' d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"/>
          </svg>
      </Button>

    </Menubar.Root>
  </div>

    <ScrollArea class='h-full'>
      <Table.Root class='h-full'>
        <Table.Caption>Annotations List</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-50">Annotations</Table.Head>
            <Table.Head>
              <div>Frames
                <Slider type='single' min={range[0]} max={range[1]} step={1} value={current_frame} onValueChange={(e) => {
                  console.error('seek frame slider', e)
                  onSeekFrame(e)
                }}/>
              </div>
              <div>
                Range {range[0]}/{range[1]}
                <Slider type='multiple'
                    min={0}
                    max={total_frames}
                    step={1}
                    bind:value={range}
                  />
              </div>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each annotations as annotation :videoAnnotation}
            <Table.Row onclick={() => {onSelectAnnotation(annotation)}}
              data-state={selectedAnnotation == annotation? 'selected':''}>
              <Table.Cell>
                {
                  [
                    annotation.value.category?.split('/').reverse()[0],
                    annotation.metadata.id
                  ].filter(a => a).join(' - ')
                }
                <Button onclick={(e) => {
                  e.stopPropagation()
                  onDeleteAnnotation(annotation)
                }}>X</Button>
              </Table.Cell>
              <Table.Cell>
                  {#if annotation.shape.start <= range[1] && annotation.shape.end >= range[0]}
                      <div
                        style:position=relative
                        style:height='10px'
                        style:left="{(Math.max(annotation.shape.start, range[0]) - range[0]) / (range[1] - range[0]) * 100}%"
                        style:width='{
                          (
                            (
                              (Math.min(annotation.shape.end, range[1]) - range[0])
                              -
                              (Math.max(annotation.shape.start, range[0]) - range[0])
                              + 1
                            ) / (range[1] - range[0] + 1) * 100
                          )
                        }%'
                        style:background-color='rgb(14, 160, 160)'
                        style:display={'flex'}
                        >

                          {#each annotation.shape.frames as f }
                          {#if f.frame >= range[0] && f.frame <= range[1]}
                            <div
                              role='button'
                              tabindex=-1
                              onkeypress={() => {
                                onSeekFrame(f.frame)
                                selectedAnnotation = annotation
                              }}
                              onclick={()=> {
                                onSeekFrame(f.frame)
                                selectedAnnotation = annotation
                              }}
                              style:transform='rotate(45deg)'
                              style:position=absolute
                              style:height=6px
                              style:background-color="Chartreuse"
                              style:border='1px solid DeepPink'
                              style:top=2px
                              style:left='calc({
                                (
                                (f.frame - Math.max(range[0], annotation.shape.start) + 1)
                                  /
                                (Math.min(range[1], annotation.shape.end) - Math.max(range[0], annotation.shape.start) + 1)
                                )*100
                              }% - 3px)'
                              style:width={6}px
                            >

                            </div>
                            {/if}
                            {/each}
                      </div>

                  {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </ScrollArea>


</div>

