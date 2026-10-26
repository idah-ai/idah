<script lang="ts">
  import { CircleAlertIcon } from "@lucide/svelte";

  import * as Item from "$lib/components/ui/Item/index";
  import * as HoverCard from "$lib/components/ui/HoverCard/index";

  import AnnotationLabelNotFound from "$lib/components/App/Error/AnnotationLabelNotFound.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { cn } from "$lib/utils";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { getDriver } from "$lib/state/driver.svelte";
  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { resolveAnnotationLabel } from "$lib/utils/label";
  import { selection } from "$lib/state/selection.svelte";
  import type { IVideoAnnotationRecord } from "$lib/types";

  interface Props {
    annotation: IVideoAnnotationRecord;
  }
  let { annotation }: Props = $props();

  const shapeType = $derived(annotation.shape_type);
  const config = $derived(getDriver().config[shapeType]);
  const category = $derived(config.values.find((v) => v.id === annotation.category));
  const foundCategory = $derived(category !== undefined);
  const categoryColor = $derived(category?.color ?? null);
  const annGroupId = $derived(annotation.metadata?.group_id ?? annotation.id);
  const annGroupIdLastPart = $derived(annGroupId.split("-").pop());
  const displayName = $derived(
    foundCategory ? `${category?.label}-${annGroupIdLastPart}` : `Group-${annGroupIdLastPart}`,
  );
  const parentLabel = $derived(
    foundCategory ? categoryValueToLabel(category!.id) : (resolveAnnotationLabel(annotation)?.text ?? ""),
  );
</script>

{#snippet AnnotationListItem()}
  <Item.Root
    size="sm"
    class={cn(
      "border-border min-h-16 cursor-pointer border",
      foundCategory
        ? "hover:bg-primary/10 hover:border-primary"
        : "bg-destructive/5 border-destructive/50 hover:bg-destructive/10 hover:border-destructive text-destructive",
    )}
    onclick={() => {
      selection.selectAnnotation(annotation);
      getDriver().command.call("idah-video:timeline.scroll-to-annotation");
    }}
  >
    <Item.Media variant="icon">
      {#if foundCategory}
        <ShapeIcon {shapeType} color={categoryColor} />
      {:else}
        <CircleAlertIcon class="fill-destructive text-primary-foreground size-5" />
      {/if}
    </Item.Media>

    <Item.Content class="flex min-w-0">
      {#if parentLabel.length > 0}
        <Item.Description class="text-xs">
          {parentLabel}
        </Item.Description>
      {/if}

      <Item.Title class="truncate text-xs font-normal">
        {displayName}
      </Item.Title>
    </Item.Content>

    <Item.Actions class="ml-auto flex shrink-0 items-center gap-0">
      {#each getAnnotationActions(annotation, displayName) as { label, icon: Icon, disabled, onclick }, index (index)}
        <CategoryAction
          {label}
          icon={Icon}
          {disabled}
          {onclick}
          class={cn("opacity-0 transition-opacity", {
            "group-hover/item:opacity-100": !disabled,
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

{#if foundCategory}
  {@render AnnotationListItem()}
{:else}
  {@render HoverableAnnotationListItem()}
{/if}
