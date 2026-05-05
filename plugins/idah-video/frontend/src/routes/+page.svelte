<script lang="ts">
  import { mount, unmount } from "svelte";
  import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";
  import { mockContext } from "$mock/context";

  let targetElement: HTMLDivElement;
  let mounted: object | undefined = $state();

  $effect(() => {
    if (!targetElement) return;

    mounted = mount(IdahVideoPlugin, {
      target: targetElement,
      props: { context: mockContext },
    });

    return () => {
      if (mounted) {
        unmount(mounted);
        mounted = undefined;
      }
    };
  });
</script>

<div bind:this={targetElement} class="h-screen w-screen overflow-hidden"></div>
