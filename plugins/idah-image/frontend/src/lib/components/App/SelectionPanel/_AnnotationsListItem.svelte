<script lang="ts">
	import { CircleAlertIcon } from "@lucide/svelte";

  import * as Item from "$lib/components/ui/Item/index"
  import * as HoverCard from "$lib/components/ui/HoverCard/index"

  import AnnotationLabelNotFound from "$lib/components/App/Error/AnnotationLabelNotFound.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { cn } from "$lib/utils";
  import { categoryForShape, categoryValueToLabel } from "$lib/utils/annotation";
  import { getDriver } from "$lib/state/driver.svelte";
  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { resolveAnnotationLabel } from "$lib/utils/label";
  import { selection } from "$lib/state/selection.svelte";
  import type { IImageAnnotationRecord } from "$lib/types";


	interface Props {
		annotation: IImageAnnotationRecord
	}
	let { annotation}: Props = $props();

	const shapeType = $derived(annotation.shape_type);
	const config = $derived(getDriver().config);
	const category = $derived(categoryForShape(config, shapeType, annotation.category));
	const isOrphan = $derived(category === undefined);
	const categoryColor = $derived(category?.color ?? null);
	const displayName = $derived(category?.label ?? annotation.category ?? "Uncategorized");
	const parentLabel = $derived(category ? categoryValueToLabel(category.id) : (resolveAnnotationLabel(annotation)?.text ?? ""));
</script>

{#snippet AnnotationListItem()}
	<Item.Root size="sm" class={cn("border border-border cursor-pointer min-h-16",
		isOrphan ?
			"bg-destructive/5 border-destructive/50 hover:bg-destructive/10 hover:border-destructive text-destructive" :
			"hover:bg-primary/10 hover:border-primary")
		}
		onclick={() => selection.selectAnnotation(annotation)}>
		<Item.Media variant="icon">
			{#if isOrphan}
				<CircleAlertIcon class="size-5 fill-destructive text-primary-foreground" />
			{:else}
				<ShapeIcon {shapeType} color={categoryColor} />
			{/if}
		</Item.Media>

		<Item.Content class="flex min-w-0">
			{#if parentLabel.length > 0}
				<Item.Description class="text-xs">
					{parentLabel}
				</Item.Description>
			{/if}

			<Item.Title class="text-xs truncate font-normal">
				{displayName}
			</Item.Title>
		</Item.Content>

		<Item.Actions class="ml-auto flex shrink-0 items-center gap-0">
			{#each getAnnotationActions( { items: [annotation], annotationId: annotation.id }, ) as { label, icon: Icon, disabled, onClick, alwaysShow }, index (index)}
        <CategoryAction
          {label}
          icon={Icon}
          onclick={(e) => {
            if (disabled) return;
            e.stopPropagation();
            onClick(e);
          }}
          class={cn("opacity-0 transition-opacity", {
            "opacity-100": alwaysShow,
            "group-hover/item:opacity-100": !alwaysShow && !disabled,
            "cursor-not-allowed group-hover/item:opacity-30": disabled,
          })}
        ></CategoryAction>
      {/each}
		</Item.Actions>
	</Item.Root>
{/snippet}

{#snippet HoverableAnnotationListItem()}
	<HoverCard.Root openDelay={500}>
		<HoverCard.Trigger>
			{@render AnnotationListItem()}
		</HoverCard.Trigger>

		<HoverCard.Content align="center" side="left">
			<AnnotationLabelNotFound displayName={parentLabel} />
		</HoverCard.Content>
	</HoverCard.Root>
{/snippet}

{#if isOrphan}
	{@render HoverableAnnotationListItem()}
	{:else}
	{@render AnnotationListItem()}
{/if}
