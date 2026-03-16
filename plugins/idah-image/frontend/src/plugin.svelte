<script lang="ts">
  import { onMount } from "svelte";
  
  import ImageController from "$lib/components/app/controller/image-controller.svelte";
  
  import type { IActivityContext } from "$lib/context/context";

  import "./plugin.css";

  let { context }: { context: IActivityContext } = $props();

  onMount(() => {
    console.log(context.mediaUrl);
  });
</script>

<div class="relative flex h-full w-full flex-col">
<ImageController {context} />
</div>
