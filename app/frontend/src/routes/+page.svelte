<script>
    import VideoPlayer from "$lib/video_player.svelte";

    let a = [
        [[0.11160714285714286 ,0.25], [0.11160714285714286,0.5],[0.22321428571428573,0.5], [0.22321428571428573,0.25]]
    ]
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>


<VideoPlayer
    selections= {[
        [[0.11160714285714286 ,0.25], [0.11160714285714286,0.5],[0.22321428571428573,0.5], [0.22321428571428573,0.25]]
    ]}
/>