<script lang="ts">
  import type { IActivityContext } from "$lib/context";
  import { onMount } from "svelte";

  import "./plugin.css";

  let { context }: { context: IActivityContext } = $props();

  onMount(() => {
    console.log(context.mediaUrl);
  });
</script>

<!-- <video controls>
  <source src={context.mediaUrl} type="video/mp4" />
</video> -->

<img src={context.mediaUrl} alt="Media" />
