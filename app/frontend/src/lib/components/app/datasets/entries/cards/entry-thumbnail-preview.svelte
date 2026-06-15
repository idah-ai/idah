<script lang="ts">
  import { onDestroy } from "svelte";

  import { AspectRatio } from "@/components/ui/aspect-ratio";

  interface Props {
    thumbnailUrl: string | null;
    thumbnailError: boolean;
  }

  let { thumbnailUrl, thumbnailError }: Props = $props();

  const TOTAL_POSITIONS = 10;
  const ANIMATION_INTERVAL_MS = 350;

  let currentImagePosition = $state(0);
  let animationInterval: number | null = null;

  function startAnimation() {
    if (animationInterval) return;
    animationInterval = setInterval(() => {
      currentImagePosition = (currentImagePosition + 1) % TOTAL_POSITIONS;
    }, ANIMATION_INTERVAL_MS);
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    currentImagePosition = 0;
  }

  onDestroy(stopAnimation);
</script>

<AspectRatio ratio={16 / 9} class="bg-muted rounded-lg">
  {#if thumbnailUrl}
    <div
      role="img"
      class="relative h-full w-full overflow-hidden rounded-lg"
      onmouseenter={startAnimation}
      onmouseleave={stopAnimation}
    >
      <img
        src={thumbnailUrl}
        alt="Entry thumbnail"
        class="absolute top-0 left-0 h-full cursor-pointer object-cover"
        style:width="{TOTAL_POSITIONS * 100}%"
        style:max-width="none"
        style:transform="translateX(-{currentImagePosition * (100 / TOTAL_POSITIONS)}%)"
      />
    </div>
  {:else if thumbnailError}
    <div class="text-muted-foreground flex h-full items-center justify-center text-sm">Unable to load thumbnail</div>
  {:else}
    <div class="flex h-full items-center justify-center">
      <div class="bg-muted/50 h-full w-full animate-pulse rounded-lg"></div>
    </div>
  {/if}
</AspectRatio>
