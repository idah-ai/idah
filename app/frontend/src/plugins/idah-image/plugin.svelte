<script lang="ts">
    import type { IActivityContext } from "@/plugin/interface/Activity";
    import Video from "../idah-video/video-annotation-activity/video.svelte"
    import { onMount } from "svelte";

    let {context}:{context: IActivityContext} = $props()

    let player_container: HTMLDivElement|undefined = $state()
    let player: Video | undefined = $state();

    onMount(() => {
        player?.source(context.mediaUrl)
    })
</script>

<div>
    plugin idah-image
</div>



