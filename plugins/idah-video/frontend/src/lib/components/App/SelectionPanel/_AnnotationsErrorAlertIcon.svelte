<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";

  import { pluralizeUnit } from "$lib/utils/unit";

  const totalAnnotationErrorCount: number = 1;
</script>

<Tooltips align="center">
	{#snippet trigger()}
		<div class="rounded-full size-5 bg-destructive/10 text-destructive flex items-center justify-center">
			<TriangleAlertIcon class="size-3" />
		</div>
	{/snippet}

	{#snippet content()}
		{totalAnnotationErrorCount} {pluralizeUnit(totalAnnotationErrorCount, "annotation error")}
	{/snippet}
</Tooltips>
