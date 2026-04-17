<script lang="ts">
  import { selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "../context/video-annotation-context";
  import { findCategory } from "../utils/category";
  import type { IActivityContext } from "$idah/context/activity-context";
  import { getContext } from "svelte";
  import { cn } from "$lib/utils";
  import { truncate } from "$lib/utils/string";
  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";

  // Context
  let context: IActivityContext = getContext("context");

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
  }

  let { annotationGroup }: Props = $props();
  let { groupId } = $derived(annotationGroup);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId == groupId);
  let [groupTitle, groupTitleWithCategory] = $derived(
    getGroupTitle({ annotationGroup }),
  );

  // Functions
  function getGroupTitle(props: {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
  }): [string, string] {
    const { annotationGroup } = props;
    const { groupId, annotations: anns } = annotationGroup;
    const splittedGroupId = groupId.split("-");
    const lastPartOfGroupId = splittedGroupId[splittedGroupId.length - 1];
    const fallbackGroupTitle = `Group-${lastPartOfGroupId}`;

    const firstAnnotationInGroup = anns[0];
    const firstAnnotationCategoryId = firstAnnotationInGroup.value.category;
    if (!firstAnnotationCategoryId) return ["", fallbackGroupTitle];

    const foundCategory = findCategory({
      labelConfig: context.config,
      categoryId: firstAnnotationCategoryId,
      shapeType: firstAnnotationInGroup.shape.type,
    });

    if (!foundCategory) return ["", fallbackGroupTitle];

    return [
      categoryValueToLabel(foundCategory.id),
      `${foundCategory.label}-${lastPartOfGroupId}`,
    ];
  }

  function categoryValueToLabel(value?: string) {
    if (!value) return "";

    const label = value
      .split("/")
      .map((s) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""));

    // remove the last part of array
    label.pop();

    return label.join(" / ");
  }
</script>

<div class="grid grid-cols-1 auto-cols-max items-center">
  <!-- Parent -->
  {#if groupTitle}
    <div class="text-xs text-muted-foreground">
      {#if groupTitle.length > 35}
        <Tooltips side="top">
          {#snippet trigger()}
            {truncate(groupTitle, 35)}
          {/snippet}

          {#snippet content()}
            {groupTitle}
          {/snippet}
        </Tooltips>
      {:else}
        {groupTitle}
      {/if}
    </div>
  {/if}

  <!-- Category -->
  <span
    class={{
      "font-bold text-primary": isGroupSelected,
    }}
  >
    {groupTitleWithCategory}
  </span>
</div>
