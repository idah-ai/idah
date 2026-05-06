<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import { SidebarMenuButton, SidebarMenuItem } from "$lib/components/ui/sidebar";

  import { cn } from "$lib/utils";

  import CategoryAction from "$lib/components/app/sidebar/category/image-category-action.svelte";
  import CategoryName from "$lib/components/app/sidebar/category/image-category-name.svelte";
  import PolygonCircleIcon from "$lib/plugin/icon/polygon-circle-icon.svelte";
  import VectorSquareIcon from "$lib/plugin/icon/vector-square-icon.svelte";

  import { selectedAnnotationGroup } from "$lib/plugin/store/store";
  import { IMAGE_BOUNDING_BOX } from "$lib/plugin/types";

  import type { AnnotationGroup } from "$lib/context/annotation-context";
  import type { CategoryDefinition } from "$lib/context/category-context";
  import type { IActivityContext } from "$lib/context/context";
  import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";

  // Props
  interface Props {
    category: CategoryDefinition;
    annotationGroup: AnnotationGroup<ImageAnnotationObject>;
    level: number;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<ImageAnnotationObject>) => void;
    onDeleteAnnotation: (annotation: ImageAnnotationObject) => void;
  }
  let { category, annotationGroup, level, onSelectAnnotationGroup, onDeleteAnnotation }: Props = $props();

  // Context
  let context: IActivityContext = getContext("context");

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

  function toggleAnnotationGroupVisibility() {
    context.commands.run("annotation.toggleGroupVisibility", { groupId });
  }

  function toggleAnnotationGroupEditability() {
    context.commands.run("annotation.toggleGroupEditability", { groupId });
  }

  function deleteAnnotationGroup() {
    context.commands.run("annotation.deleteGroup", { groupId });
  }
</script>

<SidebarMenuItem class="list-none">
  <SidebarMenuButton
    class={cn("group hover:bg-primary/10 w-full gap-0 pr-0 hover:cursor-pointer", {
      "bg-primary/10 font-semibold": isSelected,
    })}
    onclick={selectAnnotationGroup}
  >
    <div class="flex w-full items-center gap-1 text-xs" style:padding-left={`${Number(level - 1) + 1.5}rem`}>
      <div class="shrink-0">
        <div>
          {#if annotationGroup.annotations[0].shape.type === IMAGE_BOUNDING_BOX}
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
          onclick={toggleAnnotationGroupVisibility}
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
          onclick={toggleAnnotationGroupEditability}
        >
          {#if isAllLocked}
            <LockIcon />
          {:else}
            <LockOpenIcon />
          {/if}
        </CategoryAction>

        <!-- BUTTON::DELETE ALL ANNOTATIONS -->
        <CategoryAction class="hidden group-hover:flex" onclick={deleteAnnotationGroup}>
          <Trash2Icon />
        </CategoryAction>
      </div>
    </div>
  </SidebarMenuButton>
</SidebarMenuItem>
