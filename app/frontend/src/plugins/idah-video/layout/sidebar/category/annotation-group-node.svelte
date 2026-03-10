<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

  import { cn } from "@/utils";

  import type {
    AnnotationGroup,
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";

  import { selectedAnnotationGroup } from "../../../video-annotation-activity/store";
  import CategoryAction from "./category-action.svelte";
  import CategoryName from "./category-name.svelte";
  import VectorSquareIcon from "./vector-square-icon.svelte";
  import PolygonCircleIcon from "./polygon-circle-icon.svelte";
  import { IDAH_VIDEO_BOUNDING_BOX } from "../../../type";

  import type { CategoryDefinition } from "@/context/ActivityContext";

  // Type
  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

  // Props
  interface Props {
    category: CategoryDefinition;
    annotationGroup: AnnotationGroup<TAnnotationObj>;
    level: number;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<TAnnotationObj>) => void;
    onVisibility: (hidden: boolean, annotation?: TAnnotationObj) => void;
    onLock: (locked: boolean, annotation?: TAnnotationObj) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj) => void;
  }
  let { category, annotationGroup, level, onSelectAnnotationGroup, onVisibility, onLock, onDeleteAnnotation }: Props =
    $props();

  // Variables
  let { groupId, annotations } = $derived(annotationGroup);
  let lastPartOfGroupId = $derived(groupId.split("-").reverse()[0]);
  let isSelected = $derived($selectedAnnotationGroup?.groupId == groupId);
  let isAllHidden = $derived(annotations.map((annotation) => annotation.hidden).every((hidden) => hidden));
  let isAllLocked = $derived(annotations.map((annotation) => annotation.locked).every((locked) => locked));

  // function
  function selectAnnotationGroup() {
    $selectedAnnotationGroup = annotationGroup;
    onSelectAnnotationGroup(annotationGroup);
  }

  function toggleVisibilityAllAnnotations() {
    annotations.forEach((annotation) => onVisibility(!isAllHidden, annotation));
  }

  function toggleLockAllAnnotations() {
    annotations.forEach((annotation) => onLock(!isAllLocked, annotation));
  }

  function deleteAllAnnotations() {
    annotations.forEach((annotation) => onDeleteAnnotation(annotation));
  }
</script>

<SidebarMenuItem class="list-none">
  <SidebarMenuButton
    class={cn("group hover:bg-primary/10 w-full gap-0 pr-0 hover:cursor-pointer", {
      "bg-primary/10 font-semibold": isSelected,
    })}
    onclick={selectAnnotationGroup}
  >
    <div class="flex w-full items-center gap-1 text-xs" style="padding-left: {Number(level - 1) + 0.5}rem">
      <div class="shrink-0">
        <div>
          {#if annotationGroup.annotations[0].shape.type === IDAH_VIDEO_BOUNDING_BOX}
            <VectorSquareIcon />
          {:else}
            <PolygonCircleIcon />
          {/if}
        </div>
      </div>

      <CategoryName name="{category.name}-{lastPartOfGroupId}" />

      <!-- BUTTON::HIDE/SHOW, LOCK/UNLOCK, DROPDOWN ACTIONS -->
      <div class="ml-auto flex items-center gap-0">
        <!-- BUTTON::HIDE/SHOW ALL ANNOTATIONS -->
        <CategoryAction
          class={cn({
            flex: isAllHidden,
            "hidden group-hover:flex": !isAllHidden,
          })}
          onclick={toggleVisibilityAllAnnotations}
        >
          {#if isAllHidden}
            <EyeOffIcon />
          {:else}
            <EyeIcon />
          {/if}
        </CategoryAction>

        <!-- BUTTON::LOCK & UNLOCK ALL ANNOTATIONS -->
        <CategoryAction
          class={cn({
            flex: isAllLocked,
            "hidden group-hover:flex": !isAllLocked,
          })}
          onclick={toggleLockAllAnnotations}
        >
          {#if isAllLocked}
            <LockIcon />
          {:else}
            <LockOpenIcon />
          {/if}
        </CategoryAction>

        <!-- BUTTON::DELETE ALL ANNOTATIONS -->
        <CategoryAction class="hidden group-hover:flex" onclick={deleteAllAnnotations}>
          <Trash2Icon />
        </CategoryAction>
      </div>
    </div>
  </SidebarMenuButton>
</SidebarMenuItem>
