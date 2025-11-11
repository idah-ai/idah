<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import videojs from "video.js";
  import "video.js/dist/video-js.css";
  import type Player from "video.js/dist/types/player";

  const DEFAULT_FPS = 30;

  type Props = {
    element?: HTMLDivElement;
    onFramesChange: (current: number, frames: number, isPlaying: boolean) => void;
    onVolumeChange: (volume: number, muted: boolean) => void;
    onResize?: () => void;
  };

  let { element = $bindable(), onFramesChange, onResize, onVolumeChange }: Props = $props();

  let player: Player | undefined = $state();
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
    // sources: [
    //     {src: `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files/410910ci5lpcck5qmh.mp4/master.m3u8`}
    // ]
    // poster:"",
  };
  let duration = $state(0);
  let fps = $state(DEFAULT_FPS);
  let frames = $derived(Math.round(duration * fps));
  let volume = $state(0);
  let muted = $state(false);
  let mediaTime = $state(0);
  let currentFrame = $derived(Math.min(frames, Math.round(mediaTime * fps) + 1));
  let isPlaying = $state(false);
  let raf: number | undefined = $state();

  $effect(() => onFramesChange?.(currentFrame, frames, isPlaying));
  $effect(() => onVolumeChange?.(volume, muted) && console.log({ volume_changed: { volume, muted } }));

  $effect(() => console.debug({ currentFrame, frames, mediaTime, duration, isPlaying }));
  export const getFrames = () => frames;

  export function togglePlay() {
    if (player?.paused()) player?.play();
    else {
      player?.pause();
    }
  }

  export function source(src?: string) {
    return player?.src(src);
  }

  export function nextFrame(count = 1) {
    if (!fps) console.error({ fps, nextFrame });

    if (!player?.paused()) player?.pause();
    seekToFrame(currentFrame + count);
  }

  export function previousFrame(count = 1) {
    if (!fps) console.error({ fps, nextFrame });

    if (!player?.paused()) player?.pause();
    seekToFrame(currentFrame - count);
  }

  export function toggleMute() {
    player?.muted(!player?.muted());
  }

  export function setVolume(percent: number) {
    if (player?.muted()) player?.muted(false);
    return player?.volume(percent / 100);
  }

  export function seekToFrame(frame: number) {
    if (!fps) return console.log({ seekToFrame, fps, frame });

    // + 0.001 to account for browser rounding difference
    player?.currentTime((frame - 1 + 0.001) / fps);
  }

  export function playbackRate(value: number) {
    player?.playbackRate(value);
  }

  function setUpPlayer() {
    player = videojs(element, options);
    volume = (player.volume() || 0) * 100;
    quality_check("onMount");

    player.on("durationchange", () => {
      duration = player?.duration() || 0;
    });

    // player?.qualityLevels().on('change', () => quality_check('qualityLevels on change'))
    // player?.tech_.vhs.qualityLevels_.on('change', quality_check)
    player.on("durationchange", () => quality_check("durationchange"));
    player.on("loadstart", () => quality_check("loadstart"));
    player.on("sourceset", () => quality_check("sourceset"));
    player.on("loadeddata", () => quality_check("loadeddata"));
    player.on("loadedmetadata", () => quality_check("loadedmetadata"));
    player.on("resize", () => {
      onResize?.();
      // quick fix for now // I'll review it all post plugin
      quality_check("resize");
    });
    player.on("timeupdate", () => {
      mediaTime = player?.currentTime() || 0;
    });
    //    player.on('stalled', () => console.log('stalled'));
    //    player.on('ready', () => console.log('ready'));
    //    player.on('progress', () => console.log('progress'));
    //    player.on('change', () => console.log('change'));
    //    player.on('statechanged', () => console.log('statechanged'));

    player.on("play", () => {
      isPlaying = true;
      raf = requestAnimationFrame(trackFrame);
    });

    player.on("pause", () => {
      isPlaying = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = undefined;
      }
      mediaTime = player.currentTime();
    });

    player.on("volumechange", () => {
      volume = player.volume() * 100;
      muted = player.muted();
    });

    player.on("playing", () => {});

    player.on("seeked", () => {
      mediaTime = player?.currentTime() || 0;
    });

    // player.on('seeking', (e) => {
    //     console.warn('seeking?')
    // })

    player.on("suspend", () => {});

    console.debug({ setup_player: player, element, options });
  }

  console.debug({ init_video_element: element });

  onMount(setUpPlayer);

  function trackFrame() {
    mediaTime = player?.currentTime() || 0;
    raf = requestAnimationFrame(trackFrame);
  }

  function quality_check(from?: string) {
    let qualityLevel = player?.qualityLevels()[player?.qualityLevels().selectedIndex];

    duration = player?.duration() || 0;
    fps = qualityLevel?.frameRate || DEFAULT_FPS; // ....
    console.debug({ quality_check_from: from, duration, fps });
  }

  onDestroy(() => {
    player?.dispose();
  });
</script>

<video-js id="idah-video" bind:this={element} onloadeddata={(e) => console.log(e)}></video-js>
