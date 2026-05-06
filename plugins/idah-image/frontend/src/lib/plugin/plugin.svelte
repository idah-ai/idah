<script lang="ts">
  import "./plugin.css";

  import ImageController from "$lib/components/app/controller/image-controller.svelte";

  import type { IActivityContext } from "$lib/context/context";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<div class="relative flex h-full w-full flex-col">
  <ImageController {context} />
</div>
