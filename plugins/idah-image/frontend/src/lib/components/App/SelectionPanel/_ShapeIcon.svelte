<script lang="ts">
  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";
  import circleIconSvg from "$lib/assets/icons/circle.svg?raw";
  import ellipseIconSvg from "$lib/assets/icons/ellipse.svg?raw";
  import lineIconSvg from "$lib/assets/icons/minimize-2.svg?raw";
  import squareDashedIconSvg from "$lib/assets/icons/square-dashed.svg?raw";

  import {
    IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE,
    IMAGE_ELLIPSE as IDAH_IMAGE_ELLIPSE,
    IMAGE_LINE as IDAH_IMAGE_LINE,
    IMAGE_MASK,
    IMAGE_POLYGON,
  } from "$lib/types";

  type Props = {
    shapeType: string | undefined;
    color?: string | null;
  };

  let { shapeType, color = null }: Props = $props();
</script>

{#if shapeType === IMAGE_POLYGON}
  <Icon src={polygonIconSvg} {color} />
{:else if shapeType === IDAH_IMAGE_CIRCLE}
  <Icon src={circleIconSvg} {color} />
{:else if shapeType === IDAH_IMAGE_ELLIPSE}
  <Icon src={ellipseIconSvg} {color} />
{:else if shapeType === IDAH_IMAGE_LINE}
  <Icon src={lineIconSvg} {color} />
{:else if shapeType === IMAGE_MASK}
  <Icon src={squareDashedIconSvg} {color} />
{:else}
  <Icon src={vectorSquareIconSvg} {color} />
{/if}
