<script lang="ts">
    import type { IActivityContext } from "@/plugin/interface/Activity";
    import VideoAnnotationActivity from "./video-annotation-activity.svelte";


    let {context}:{context: IActivityContext} = $props()
</script>


<VideoAnnotationActivity {context}/>
