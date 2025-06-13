<script module>
    export type VideoFrameSelection = {
        frame :number;
        points :Array<Array<number>>
    }

    export interface VideoBoundingBox extends AnnotationShape {
        type: 'VideoBoundingBox'
        selections: Array<VideoFrameSelection>
    }
 
    export interface VideoBoundingPolygon extends AnnotationShape {
        type: 'VideoBoundingPolygon'
        selections: Array<VideoFrameSelection>
    }
</script>

<script lang='ts'>
    import videojs from 'video.js'
    import 'video.js/dist/video-js.css'
    import { onMount, onDestroy } from 'svelte';
	import type Player from 'video.js/dist/types/player';
	import type { AnnotationMetadata, AnnotationObj, AnnotationShape, AnnotationValue } from './context/AnnotationContext';

    let annotations :Array<AnnotationObj<VideoBoundingBox | VideoBoundingPolygon, AnnotationValue, AnnotationMetadata>> = $state([])

    const ZOOM_STEP = 0.5
    const MIN_SCALE = 1
    const MAX_SCALE = 40

    let width = 896;
    let height = 400;

    let scale = $state(1);

    let video_height: number = $state(0);
    let video_width: number = $state(0);

    let videoElement: HTMLVideoElement;

    let options = {
            controls: false,
            preload: "auto",
            loop: false,
            muted: true,
            // responsive: true,
            fluid: true,
            sources: [{
                src: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
            }]
            // poster:"http://video-js.zencoder.com/oceans-clip.png",
        }
    let player: Player;
    let fps = 24; // Needs to be known
    let volume = $state(0);
    let duration = $state(0);
    let frames = $state(0);
    let current_frame = $state(0);
    let offsetX = $state(0);
    let offsetY = $state(0);


    let isPanning = $state(false)
    let panX :number = $state(0)
    let panY :number = $state(0)

    let ctrlPressed = $state(false)
    let isBbSelecting = $state(false)
    let bbStartX :number = $state(0)
    let bbStartY :number = $state(0)
    let bbEndX :number = $state(0)
    let bbEndY :number = $state(0)

    let mouseX = $state(0)
    let mouseY = $state(0)

    onMount(()=> {
        player = videojs(videoElement, options, () => {
            video_height = player.currentHeight();
            video_width = player.currentWidth();

            player.on('loadeddata', () => {
                duration = player.duration() || 0;
                frames = Math.round(duration * fps)
            })

            player.on('timeupdate', () => {
                current_frame = Math.round((player.currentTime() || 0) * fps)
            });

            player.on('resize', () => {
                let position = player.getPositions()

                video_height = position.boundingClientRect.height;
                video_width = position.boundingClientRect.width;
            })
        })
    })

    onDestroy(() => {
        player?.dispose()
    })

    function capOffset(x: number, y: number) {
        let maxOffsetX = video_width * scale - video_width
        let maxOffsetY = video_height * scale - video_height

        offsetX = Math.max(-maxOffsetX, Math.min(offsetX, 0))
        offsetY = Math.max(-maxOffsetY, Math.min(offsetY, 0))
    }

    function panTo(x: number, y:number) { 
        if (!isPanning) return;

        offsetX = x - panX
        offsetY = y - panY

        capOffset(offsetX, offsetY)
    }

    function panStart(x: number, y: number) {
         isPanning = true
         panX = x - offsetX
         panY = y - offsetY
    }

    function panStop() { isPanning = false }

    function togglePlay() {
        if (player.paused())
            player.play();
        else
            player.pause();
    }

    function nextFrame() {
        if (!player.paused())
            player.pause()
        player.currentTime((current_frame + 1) / fps)
    }

    function previousFrame() {
        if (!player.paused())
            player.pause()
        player.currentTime((current_frame - 1) / fps)
    }

    function toggleMute() {
        player.muted(!player.muted())
    }

    function setVolume(percent: number) {
        if (player.muted())
            player.muted(false)
        player.volume(percent / 100)
    }

    function onVolumeChange(e: Event){
        setVolume(parseInt((e.target as HTMLInputElement).value))
    }

    function seek_to_frame(frame: number) {
        player.currentTime(frame / fps)
    }

    function onFrameSelection(e: Event) {
        seek_to_frame(parseInt((e.target as HTMLInputElement).value))
    }

    function zoom(x:number, y:number, step:number) {
        offsetX = (x - offsetX) / scale
        offsetY = (y - offsetY) / scale

        scale = Math.min(Math.max(MIN_SCALE, scale + step), MAX_SCALE)

        offsetX = x - (offsetX * scale)
        offsetY = y - (offsetY * scale)

        capOffset(offsetX, offsetY)
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault();
        let step = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

        zoom(e.offsetX, e.offsetY, step)
    }

    function onMouseDown(e :MouseEvent) {        
        if (e.shiftKey) {
            panStart(e.offsetX, e.offsetY)
        } else if (e.ctrlKey) {
            boundingBoxStart(e.offsetX, e.offsetY)
        }
    }

    function onMouseUp(e :MouseEvent) {
        if (isPanning) {
            panStop()
        } else if (isBbSelecting) {
            boundingBoxEnd()
        }
    }

    function onMouseMove(e :MouseEvent) {
        mouseX = e.offsetX
        mouseY = e.offsetY

        if (isPanning) {
            panTo(mouseX, mouseY)
        } else if (isBbSelecting) {
            boundingBoxSelect(mouseX, mouseY)
        }
    }

    function boundingBoxStart(x: number, y: number) {
        isBbSelecting = true
        bbStartX = bbEndX = (x - offsetX) / video_width
        bbStartY = bbEndY = (y - offsetY) / video_height
    }

    function boundingBoxSelect(x: number, y:number) {
        bbEndX = (x - offsetX) / video_width
        bbEndY = (y - offsetY) / video_height
    }

    function boundingBoxEnd() {
        console.log(annotations)
        annotations.push({
            shape: {
                type: 'VideoBoundingBox',
                selections: [
                    {
                        frame: current_frame,
                        points: [
                            [bbStartX, bbStartY],
                            [bbEndX, bbStartY],
                            [bbEndX, bbEndY],
                            [bbStartX, bbEndY]
                        ],
                    },
                ]                
            },
            value: {
                // AnnotationValue 
            },
            metadata: {
                id: '?',
                createdAt: new Date(Date.now()),
                updatedAt: new Date(Date.now())
            }
        })
        isBbSelecting = false
    }

    function onKeyDown(e :KeyboardEvent){
        console.log('key down')
        if (e.ctrlKey) {ctrlPressed = true}
    }

    function onKeyUp(e :KeyboardEvent){
        console.log('key up')
        if (!e.ctrlKey) {ctrlPressed = false}
    }

</script>
<ul>
    <li>mouse: { mouseX }/{ mouseY }</li>
    <li>isPanning: { isPanning }</li>
    <li>duration: { duration } seconds</li>
    <li>fps: { fps }</li>
    <li>frames: { frames } </li>
    <li>current_frame: { current_frame } </li>
    <li>offset: { offsetX }/ { offsetY } </li>
    <li>Container size: { width } / { height }</li>
    <li>scale: { scale } </li>
    <li>Video size: {width * scale}/{height * scale}</li>
    <li>Ctrl Pressed: {ctrlPressed}</li>
</ul>

<div style:overflow=hidden
     style:width='{width}px'
     style:height='{height}px'
     onmousedown={onMouseDown}
     onmouseup={onMouseUp}
     onmousemove={onMouseMove}
     onwheel={onWheel}
     onkeydown={onKeyDown}
     onkeyup={onKeyUp}
     role="button"
     tabindex="-1"
     >
     <!-- role button to remove warning for now .. -->
    <video-js onwheel={zoom}
        bind:this={videoElement}
        style:transform-origin= 'top left'
        style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
        >
    </video-js>
    <svg
        height= {video_height}
        width= {video_width}
        style:transform-origin = "top left"
        style:transform = "translate(0px, {-height}px)"
        style:fill-opacity=0
        >
        {#each annotations as annotation}
            {#each (annotation.shape.selections.filter((selection) => { 
                    return selection.frame == current_frame ? true : false
                })) as selection }
                    <polygon
                        vector-effect= "non-scaling-stroke"
                        points= {
                            selection.points.reduce((acc: string, point: number[]) => {
                                return acc.concat(`${point[0] * video_width},${point[1] * video_height} `)
                            }, "")
                        }
                        style:transform-origin = "top left"
                        style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
                        style:stroke = #0F0
                        style:stroke-width= {1}
                    />
                {#each selection.points as point}
                    <circle cx={point[0] * video_width} cy={point[1] * video_height} r={3/scale}
                        vector-effect= "non-scaling-stroke"
                        style:stroke = #00F
                        style:stroke-width= {2}
                        style:transform-origin = "top left"
                        style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
                    />
                {/each}
            {/each}
        {/each}
        {#if ctrlPressed}
            <line x1={0} y1={mouseY - offsetY} x2={video_width} y2={mouseY - offsetY} stroke="red"/>
            <line x1={mouseX - offsetX} y1={0} x2={mouseX - offsetX} y2={video_height} stroke="red"/>
        {/if}
        {#if isBbSelecting}
            <polygon
                vector-effect= "non-scaling-stroke"
                points={`${bbStartX * video_width},${bbStartY * video_height} ${bbEndX * video_width},${bbStartY * video_height} ${bbEndX * video_width},${bbEndY * video_height} ${bbStartX * video_width},${bbEndY * video_height}`}
                style:transform-origin = "top left"
                style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
                style:stroke = #0F0
                style:stroke-width= {1}
            />
                {#each [[bbStartX, bbStartY],[bbEndX, bbStartY],[bbEndX,bbEndY],[bbStartX, bbEndY]] as point}
                    <circle cx={point[0] * video_width} cy={point[1] * video_height} r={3/scale}
                        vector-effect= "non-scaling-stroke"
                        style:stroke = #00F
                        style:stroke-width= {2}
                        style:transform-origin = "top left"
                        style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
                    />
                {/each}
        {/if}
    </svg>
</div>
<div>
    <button onclick={previousFrame}>{'<'}</button>
    <button onclick={togglePlay}>{ 'P' }</button>
    <button onclick={nextFrame}>{'>'}</button>
    <button onclick={toggleMute}>{'M'}</button>
    <input style:width=100px type='number' min=0 max={frames} oninput={onFrameSelection}>
    <input type='range' min=0 max=100 step=1 value={volume} oninput={onVolumeChange}/>
    <input type='range' min=0 max={frames} step=1 value={current_frame} oninput={onFrameSelection}/>
</div>
