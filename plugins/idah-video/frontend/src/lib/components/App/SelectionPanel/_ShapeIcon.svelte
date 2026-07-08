<script lang="ts">
  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { VIDEO_POLYGON } from "$lib/types";

  type Props = {
    shapeType: string | undefined;
    color?: string | null;
  };

  let { shapeType, color = null }: Props = $props();
</script>

{#if shapeType === VIDEO_POLYGON}
  <Icon src={polygonIconSvg} {color} />
{:else}
  <Icon src={vectorSquareIconSvg} {color} />
{/if}
