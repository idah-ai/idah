<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import videojs from "video.js";
    import 'video.js/dist/video-js.css'
	import type Player from "video.js/dist/types/player";

    const DEFAULT_FPS = 30

    type Props = {
        element?: HTMLDivElement,
        onFramesChange: (current:number, frames:number) => void
        onVolumeChange: (volume:number) => void
    }

    let {
         element = $bindable(),
         onFramesChange,
    }: Props = $props()

    let player: Player;
    let options = {
            controls: false,
            preload: "auto",
            loop: false,
            muted: false,
            autoplay: false,
            fill: false,
            responsive: false,
            fluid: true,
            disablePictureInPicture: true,
            // poster:"",
    }
    let duration = $state(0)
    let fps = $state(DEFAULT_FPS)
    let frames = $derived(Math.ceil(duration * fps))
    let volume = $state(0)
    let mediaTime = $state(0)
    let currentFrame = $derived(Math.round(mediaTime * fps))

    $effect(() => {
        onFramesChange?.(currentFrame, frames)
    })

    export function togglePlay() {
        if (player.paused())
            player.play();
        else {
            player.pause();
        }
    }

    export function update_src(type:string, src:string) {
        player.src(src);
        player.load()
    }

    export function nextFrame() {
        if (!fps) console.error({fps, nextFrame})

        if (!player.paused())
            player.pause()
        player.currentTime((currentFrame + 1) / fps)
    }

    export function previousFrame() {
        if (!fps) console.error({fps, nextFrame})

        if (!player.paused())
            player.pause()
        player.currentTime((currentFrame - 1) / fps)
    }

    export function toggleMute() {
        player.muted(!player.muted())
    }

    export function setVolume(percent: number) {
        if (player.muted())
            player.muted(false)
        return player.volume(percent / 100)
    }

    export function seekToFrame(frame: number) {
        if (!fps) return console.log({seekToFrame, fps, frame})

        player.currentTime(frame / fps)
    }

    export function isPlaying(){
        return player ? player.paused() : false
    }
    onMount(() => {
        player = videojs(element, options, () => {
           volume = (player.volume() || 0) * 100
            quality_check()

            player.on('durationchange', () => {
                duration = player.duration() || 0;
            })


            // player.qualityLevels().on('change', () => quality_check('qualityLevels on change'))
            // player.tech_.vhs.qualityLevels_.on('change', quality_check)
            player.on('durationchange', () => quality_check('durationchange'))
            player.on('loadstart', () => quality_check('loadstart'))
            player.on('sourceset', () => quality_check('sourceset'))
            player.on('loadedata', () => quality_check('loadedata'))
            player.on('loademetadata', () => quality_check('loademetadata'))
            player.on('resize', () => quality_check('resize'))
            player.on('timeupdate', () => {});

            player.on('play', () => {
                raf = requestAnimationFrame(trackFrame)
            })
            player.on('pause', () => {
                if (raf) { cancelAnimationFrame(raf); raf = undefined }

                seekToFrame(currentFrame) // fix seek to last known frame ?
            })

            player.on('playing', () => {
            })

            player.on('seeked', () => {
                mediaTime = player.currentTime() || 0
            })

            player.on('seeking', () => {
            })

            player.on('suspend', () => {
            })

        })
    })

    let raf:number|undefined=$state()
    function trackFrame() {
        mediaTime = (player.currentTime() || 0) + 1/fps
        raf = requestAnimationFrame(trackFrame)
    }

    function quality_check(from?: string) {
        let qualityLevel = player.qualityLevels()[player.qualityLevels().selectedIndex]

        duration = player.duration() || 0;
        fps = qualityLevel?.frameRate || DEFAULT_FPS // ....
    }

    onDestroy(() => {
        player?.dispose()
    })
</script>

<video-js bind:this={element}></video-js>
