<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import { SidebarMenuButton, SidebarMenuItem } from "$lib/components/ui/Sidebar";

  import { cn } from "$lib/utils";

  import Icon from "$lib/components/ui/Icon";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import CategoryName from "$lib/components/App/CategorySelector/Category/_CategoryName.svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX } from "$idah/v2/video-types";
  import { selection } from "$lib/state/selection.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { CategoryDefinition } from "$idah/context/category-context";
  import type { IVideoAnnotationRecord } from "$idah/v2/video-types";

  // Props
  interface Props {
    category: CategoryDefinition;
    annotationGroup: AnnotationGroup<IVideoAnnotationRecord>;
    level: number;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<IVideoAnnotationRecord>) => void;
    onDeleteAnnotation: (annotation: IVideoAnnotationRecord) => void;
  }
  let { category, annotationGroup, level, onSelectAnnotationGroup, onDeleteAnnotation }: Props = $props();

  // Context
  let context: IActivityContext = getContext("context");

  // Variables
  let { groupId, annotations } = $derived(annotationGroup);
  let lastPartOfGroupId = $derived(groupId.split("-").reverse()[0]);
  let isSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" && v.groupId === groupId;
  });
  let isAllHidden = $derived(annotations.map((annotation) => annotation.hidden).every((hidden) => hidden));
  let isAllLocked = $derived(annotations.map((annotation) => annotation.locked).every((locked) => locked));

  // function
  function selectAnnotationGroup() {
    selection.selectGroup(groupId);
    onSelectAnnotationGroup(annotationGroup);
  }

  function toggleAnnotationGroupVisibility() {
    context.commands!.run("annotation.toggleGroupVisibility", { groupId });
  }

  function toggleAnnotationGroupEditability() {
    context.commands!.run("annotation.toggleGroupEditability", { groupId });
  }

  function deleteAnnotationGroup() {
    context.commands!.run("annotation.deleteGroup", { groupId });
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
          {#if annotationGroup.annotations[0].shape.type === IDAH_VIDEO_BOUNDING_BOX}
            <Icon src={vectorSquareIconSvg} />
          {:else}
            <Icon src={polygonIconSvg} />
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
