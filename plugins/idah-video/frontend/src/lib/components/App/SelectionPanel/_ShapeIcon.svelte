<script lang="ts">
  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";
  import frameIconSvg from "$lib/assets/icons/frame.svg?raw";
  import fileIconSvg from "$lib/assets/icons/file.svg?raw";

  import { ENTRY_ROOT, VIDEO_FRAME, VIDEO_POLYGON } from "$lib/types";

  type Props = {
    shapeType: string | undefined;
    color?: string | null;
  };

  let { shapeType, color = null }: Props = $props();
</script>

{#if shapeType === VIDEO_POLYGON}
  <Icon src={polygonIconSvg} {color} />
{:else if shapeType === VIDEO_FRAME}
  <Icon src={frameIconSvg} {color} />
{:else if shapeType === ENTRY_ROOT}
  <Icon src={fileIconSvg} {color} />
{:else}
  <Icon src={vectorSquareIconSvg} {color} />
{/if}
