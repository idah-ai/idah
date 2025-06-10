<script>
    import videojs from 'video.js'
    import 'video.js/dist/video-js.css'
    import { onMount, onDestroy } from 'svelte';


    let isPlaying = false;
    let player;
    let fps = 30;
    let volume = 0;
    let duration;
    let frames;
    let current_frame;

    onMount(()=> {
        player = videojs("Videotest", {
            controls: "false",
            preload:"auto",
            loop: false,
            muted: true,
            fluid: false,
            poster:"http://video-js.zencoder.com/oceans-clip.png",
        }, () => {
            console.log("player loaded ?")
        })
        player.on('loadeddata', () => {
            duration = player.duration();
            frames = duration * fps;
        })
        player.on('timeupdate', () => {
            current_frame = (player.currentTime() * fps)
            console.log(current_frame);
        });
        player.on('play', () => {
            isPlaying = true;
        });
        player.on('pause', () => {
            isPlaying = false;
        });
    })

    onDestroy(() => {
        player.dispose();
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
        player.currentTime(player.currentTime() + 1 /fps)
    }

    function previousFrame() {
        if (!player.paused())
            player.pause()
        player.currentTime(player.currentTime() - 1 /fps)
    }

    function mute() {
        player.muted(!player.muted())
    }

    function setVolume(e) {
        if (player.muted())
            player.muted(false)
        player.volume(e.target.value/100)
    }

    function seek(e) {
        player.currentTime(e.target.value/fps)
    }

    function zoom(e) {
    }
</script>

<ul>
    <li>duration: { duration }</li>
    <li>playing: { isPlaying }</li>
    <li>frames: { frames } </li>
    <li>current_frame: { current_frame } </li>
</ul>

<p></p>
,.
<!-- <video id='Videotest' class='video-js'>
    <source src="//vjs.zencdn.net/v/oceans.mp4" type="video/mp4">
    <source src="//vjs.zencdn.net/v/oceans.webm" type="video/webm">
    <track kind="captions">
</video> -->
<video-js
    id='Videotest'>
    <source src="//vjs.zencdn.net/v/oceans.mp4" type="video/mp4">
    <source src="//vjs.zencdn.net/v/oceans.webm" type="video/webm">
    <track kind="captions"/>
</video-js>
<button onclick={previousFrame}>{'<'}</button>
<button onclick={togglePlay}>p</button>
<button onclick={nextFrame}>{'>'}</button>
<button onclick={mute}>{'M'}</button>
<input type='range' min=0 max=100 step=1 value={volume} oninput={setVolume}/>
<input type='range' min=0 max={frames} step=1 value={current_frame} oninput={seek}/>
