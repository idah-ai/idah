<script lang="ts">
  import type { IActivityContext } from "./context";
  import { onMount } from "svelte";

  import "./plugin.css";

  let { context }: { context: IActivityContext } = $props();

  onMount(() => {
    console.log(context.mediaUrl);
  });
</script>

<div>plugin idah-images</div>
