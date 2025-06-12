<script lang='ts'>
    import videojs from 'video.js'
    import 'video.js/dist/video-js.css'
    import { onMount, onDestroy } from 'svelte';
	import type Player from 'video.js/dist/types/player';

    const ZOOM_STEP = 0.5
    const MIN_SCALE = 1
    const MAX_SCALE = 40

    let {selections}  = $props();
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

    onMount(()=> {
        player = videojs(videoElement, options, () => {
            console.log("this ?", player, videojs.getPlayer(videoElement))
            video_height = player.currentHeight();
            video_width = player.currentWidth();

            console.log(player.getMedia())
            console.log(video_width, video_height)

            player.on('loadeddata', () => {
                duration = player.duration() || 0;
                frames = Math.round(duration * fps)
            })

            player.on('timeupdate', () => {
                current_frame = Math.round((player.currentTime() || 0) * fps)
            });

            player.on('resize', () => {
                let position = player.getPositions()
                console.log(player.getMedia())

                
                video_height = position.boundingClientRect.height;
                video_width = position.boundingClientRect.width;

                console.log("size", 100/video_width, 100/video_height, 200/video_width, 200/video_height)

            })
        })
    })

    onDestroy(() => {
        player?.dispose()
    })

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
        player.volume(e.target.value / 100)
    }

    function onVolumeChange(e){
        setVolume(e.target.value)
    }

    function seek_to_frame(frame: number) {
        player.currentTime(frame / fps)
    }

    function onFrameSelection(e) {
        seek_to_frame(e.target.value)
    }

    function zoom(e) {
        e.preventDefault();
       console.log(e)
        console.log(e.offsetX, e.offsetY);
        offsetX = (e.offsetX - offsetX)/scale
        offsetY = (e.offsetY - offsetY)/scale
 
        let delta = e.wheelDeltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        scale = Math.min(Math.max(MIN_SCALE, scale + delta), MAX_SCALE)

        offsetX = e.offsetX - (offsetX * scale)
        offsetY = e.offsetY - (offsetY * scale)

        let maxOffsetX = (width * scale) - width
        let maxOffsetY = (height * scale) - height

        offsetX = Math.max(-maxOffsetX, Math.min(offsetX, maxOffsetX))
        offsetY = Math.max(-maxOffsetY, Math.min(offsetY, maxOffsetY))

        // videoElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

        video_height = videojs.getPlayer(videoElement)?.currentHeight() || 0 * scale
        video_width = videojs.getPlayer(videoElement)?.currentWidth() || 0 * scale


        // console.log(video_height, video_width);

    }

</script>

<!-- <ul>
    <li>duration: { duration } seconds</li>
    <li>fps: { fps }</li>
    <li>frames: { frames } </li>
    <li>current_frame: { current_frame } </li>
    <li>offset: { offsetX }/ { offsetY } </li>
    <li>Container size: { width } / { height }</li>
    <li>scale: { scale } </li>
    <li>Video size: {width * scale}/{height * scale}</li>
</ul>
 -->
<div style='overflow:hidden; width:{width}px; height:{height}px'>
    <video-js onwheel={zoom}
        bind:this={videoElement}
        style:transform-origin= 'top left'
        style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
        >
    </video-js>
    <svg
        onwheel={zoom}
        height= {video_height}
        width= {video_width}
        style:stroke = 'yellow'
        style:stroke-width= {1}
        style:fill-opacity= {0}
        style:transform-origin = "top left"
        style:transform = "translate(0px, {-height}px)"
        >
        {#each selections as selection}
        {console.log(selection,                selection.map((point : number[]) => {
                    console.log('map',point);
                    return [point[0] * video_width, point[1] * video_height]
                }))}
        <polygon
            vector-effect= "non-scaling-stroke"
            points= {
                selection.map((point : number[]) => {
                    console.log('map',point);
                    // point
                    return [point[0] * video_width, point[1] * video_height]
                }).reduce(
                    (acc: string, cur: number[]) => {
                        console.log('reducer',acc, cur)
                        return acc.concat(`${cur[0]},${cur[1]} `)
                    },
                    ""
                )
            }
            style:transform-origin = "top left"
            style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"

        />
        {/each}
<!-- 
        <polygon
            vector-effect= "non-scaling-stroke"
            points= "{0.11160714285714286 * video_width},{0.25 * video_height} {0.11160714285714286 * video_width},{0.5 * video_height} {0.22321428571428573 * video_width},{0.5 * video_height} {0.22321428571428573 * video_width},{0.25 * video_height}"
            style:transform-origin = "top left"
            style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"

            />
        <polygon
            points= "250,100 350,100 350,200 250,200"
            vector-effect= "non-scaling-stroke" 
            style:transform = "translate({offsetX}px, {offsetY}px) scale({scale})"
        /> -->
    </svg>
</div>
        <ul>
            <li>duration: { duration } seconds</li>
            <li>fps: { fps }</li>
            <li>frames: { frames } </li>
            <li>current_frame: { current_frame } </li>
            <li>offset: { offsetX }/ { offsetY } </li>
            <li>Container size: { width } / { height }</li>
            <li>scale: { scale } </li>
            <li>Video size: {width * scale}/{height * scale}</li>
        </ul>

<div>
    <button onclick={previousFrame}>{'<'}</button>
    <button onclick={togglePlay}>{ 'P' }</button>
    <button onclick={nextFrame}>{'>'}</button>
    <button onclick={toggleMute}>{'M'}</button>
    <input type='range' min=0 max=100 step=1 value={volume} oninput={onVolumeChange}/>
    <input type='range' min=0 max={frames} step=1 value={current_frame} oninput={onFrameSelection}/>
</div>
