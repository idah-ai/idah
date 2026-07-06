<script lang="ts">
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { cn } from "$lib/utils";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import type { Menus } from "$lib/components/App/ContextMenu/types";
  import type { IImageAnnotationRecord } from "$lib/types";

  type Props = {
    annotations: IImageAnnotationRecord[];
  };

  let { annotations }: Props = $props();

  const isAllHidden = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isHidden(ann)));
  const isAllLocked = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isLocked(ann)));
  const isSomeLocked = $derived(annotations.length > 0 && annotations.some((ann) => annotation.isLocked(ann)));

  const menus = $derived<Menus>({
    actions: {
      items: {
        "visibility-all": {
          label: "Show/Hide All",
          icon: isAllHidden ? EyeOffIcon : EyeIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_visibility_all");
          },
        },
        "editability-all": {
          label: "Lock/Unlock All",
          icon: isAllLocked ? LockIcon : LockOpenIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_editability_all");
          },
        },
        "delete-all": {
          label: "Delete all annotations",
          icon: Trash2Icon,
          disabled: isSomeLocked || viewport.isReviewWorkspace,
          onClick: () => {
            showConfirmDialog({
              title: "Delete all annotations",
              description: "Are you sure you want to delete all annotations?",
              onConfirm: () => getDriver().command.call("annotation.delete_all"),
            });
          },
        },
      },
    },
  });
</script>

<section class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <Text weight="semibold">Annotations</Text>
    <Badge variant="secondary">{annotations.length}</Badge>

    <div class="ml-auto flex items-center">
      {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, onClick, disabled }] (key)}
        <CategoryAction {label} icon={Icon} {disabled} onclick={onClick} />
      {/each}
    </div>
  </div>
  <div class="flex flex-col gap-1">
    <Separator class="my-2" />
    {#each annotations as ann (ann.id)}
      {@const annShapeType = ann.shape.type as string}
      {@const annConfig = getDriver().config[annShapeType]}
      {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
      {@const annColor = annCategory?.color ?? null}
      {@const annDisplayName = annCategory?.label ?? ann.value?.category ?? "Uncategorized"}
      {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
      <div class="group hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        <button
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          onclick={() => selection.selectAnnotation(ann)}
        >
          <ShapeIcon shapeType={annShapeType} color={annColor} />
          <div class="flex min-w-0 flex-col">
            {#if annParentLabel.length > 0}
              <span class="text-muted-foreground truncate text-xs">{annParentLabel}</span>
            {/if}
            <span class="truncate">{annDisplayName}</span>
          </div>
        </button>

        <div class="ml-auto flex shrink-0 items-center gap-0">
          {#each getAnnotationActions( { items: [ann], annotationId: ann.id }, ) as { label, icon: Icon, disabled, onClick, alwaysShow }, index (index)}
            <CategoryAction
              {label}
              icon={Icon}
              onclick={(e) => {
                if (disabled) return;
                e.stopPropagation();
                onClick(e);
              }}
              class={cn("opacity-0", {
                "opacity-100": alwaysShow,
                "group-hover:opacity-100": !alwaysShow && !disabled,
                "cursor-not-allowed group-hover:opacity-30": disabled,
              })}
            ></CategoryAction>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>
