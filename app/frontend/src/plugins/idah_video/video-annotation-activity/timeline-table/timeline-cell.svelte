<script lang='ts'>
	import { Button } from "@/components/ui/button";
	import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

    let {
        frame,
        currentFrame,
        range,
        scale,
        inSpan,
        keyframes,
        hovered,
        onSeekFrame,
        onDeleteFrame,
        ...restProps
    } : {
        frame: number,
        currentFrame: number,
        range: [number, number],
        scale: number,
        inSpan: boolean,
        keyframes: number[],
        hovered: boolean,
        onSeekFrame: (frame: number) => void,
        onDeleteFrame: (frame: number) => void,
    } = $props()
</script>

<div
    class="border-t-0 border-b-0 hoverable inline-block border {Math.floor(currentFrame/scale) == Math.floor(frame/scale) ? 'border-[grey] bg-primary' : hovered ? 'border-destructive' : inSpan? '' : 'border-[grey]'}"
    style:box-sizing=border-box

    style:width={1 / ((range[1]-range[0] + (scale - ((range[1]-range[0]) % scale))) / 100) * scale}%
    style:height=100%
    onclick={() => onSeekFrame(frame)}
    {...restProps}
>
    <div class='py-1' style:height=100%>
    {#if inSpan}
        <div class='relative' style:background-color='#CFFAFE' style:height=100%>
        {#if keyframes.length}
                <Popover>
                <PopoverTrigger class='absolute top-0 h-full w-full pt-0'>
                    <div style='margin:auto' style:background-color='#06B6D4'  style:height=25% style:width=50%></div>
                </PopoverTrigger>
                    <PopoverContent>
                    <ul>
                        {#each keyframes as keyframe}
                        <li>
                            <Button onclick={() => onSeekFrame?.(keyframe)}>Seek to {keyframe}</Button>
                            <Button onclick={() => onDeleteFrame?.(keyframe)}>X</Button>
                        </li>
                        {/each}
                    </ul>
                    </PopoverContent>
                </Popover>
        {/if}
        </div>
    {/if}
    </div>
</div>

<style>
  .hoverable:hover {
    border-top:solid 1px red;
    border-bottom:solid 1px red;
    background-color: red;
  }
</style>
