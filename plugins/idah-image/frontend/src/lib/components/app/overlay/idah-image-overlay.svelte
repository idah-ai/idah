<script lang="ts">
  import BoundingBox from "./bounding-box.svelte";

  import type {
      AnnotationMetadata,
      AnnotationObj,
      AnnotationShape,
      AnnotationValue
  } from "./AnnotationContext";

  // import type { Point } from "./VideoAnnotationContext";

  export let src: string;

  export let selected:
    | AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>
    | undefined;

  export let annotations:
    | AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[] = [];

  // export let mode: string;

  export let onSelectAnnotation: (
    annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>
  ) => void;

  export let onSelection: (
    type: string,
    angle?: number,
    id?: string
  ) => void;

  let container: HTMLDivElement;
  let image: HTMLImageElement;

  let width = 1;
  let height = 1;

  function handleLoad() {
    width = image.naturalWidth;
    height = image.naturalHeight;
  }
</script>

<div bind:this={container} class="relative h-full w-full overflow-hidden">
    <div class="relative inline-block">

      <img
        bind:this={image}
        src={src}
        alt=""
        on:load={handleLoad}
        class="block max-w-full select-none pointer-events-none"
      />

      <svg
        class="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${width} ${height}`}
      >
        {#each annotations as annotation (annotation.id)}
          <BoundingBox
            {annotation}
            selected={annotation.id === selected?.id}
            onSelect={() => onSelectAnnotation(annotation)}
            onChange={(points) =>
              onSelection(annotation.shape.type, points, undefined, annotation.id)
            }
          />
        {/each}
      </svg>

    </div>
</div>

<style>
  svg {
    pointer-events: none;
  }

  :global(.bbox) {
    pointer-events: auto;
  }
</style>