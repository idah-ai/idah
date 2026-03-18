<script lang="ts">
  import type { IActivityContext } from "$idah/context/activity-context";
  import { onMount } from "svelte";

  import "./plugin.css";

  let { context }: { context: IActivityContext } = $props();

  onMount(() => {
    console.log(context.mediaUrl);
  });
</script>

<h1>{{pluginDisplayName}}</h1>
<p>{{pluginDescription}}</p>
