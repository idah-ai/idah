<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";

  import { countOrphanAnnotations } from "$lib/utils/annotation";
  import { getDriver } from "$lib/state/driver.svelte";
  import { pluralizeUnit } from "$lib/utils/unit";

  import type { IImageAnnotationRecord } from "$lib/types";

  interface Props {
  	annotations: IImageAnnotationRecord[]
  };
  let { annotations }: Props = $props();

  const errorCount = $derived(countOrphanAnnotations(annotations, getDriver().config))
</script>

{#if errorCount > 0}
	<Tooltips align="center">
		{#snippet trigger()}
			<div class="rounded-full size-5 bg-destructive/10 text-destructive flex items-center justify-center">
				<TriangleAlertIcon class="size-3" />
			</div>
		{/snippet}

		{#snippet content()}
			{errorCount} {pluralizeUnit(errorCount, "annotation")} has no label found
		{/snippet}
	</Tooltips>
{/if}
