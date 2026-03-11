<script lang="ts">
  import { onMount } from "svelte";
  
  import IdahImageController from "$lib/components/app/controller/idah-image-controller.svelte";
  import type { IActivityContext } from "./context";

  import "./plugin.css";

  let { context }: { context: IActivityContext } = $props();

  onMount(() => {
    console.log(context.mediaUrl);
  });
</script>

<div class="relative flex h-full w-full flex-col">
<IdahImageController {context} />
</div>
