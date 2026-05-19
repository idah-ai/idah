<script lang="ts">
  import { SidebarMenuButton, SidebarMenuItem } from "$lib/components/ui/Sidebar";

  import { cn } from "$lib/utils";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import CategoryName from "$lib/components/App/CategorySelector/Category/_CategoryName.svelte";
  import Icon from "$lib/components/ui/Icon";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX } from "$lib/types";

  import type { IConfigValue } from "$idah/v2/types";
  import type { IVideoAnnotationRecord } from "$lib/types";
  import { getCategoryActions } from "../menus";

  type AnnotationGroup<T> = { groupId: string; annotations: T[] };
  type CategoryDefinition = IConfigValue & {
    id: string;
    name: string;
    description?: string;
    requiredNested?: boolean;
    nestedCategories?: CategoryDefinition[];
    isExpanded?: boolean;
    count?: number;
    data?: IConfigValue;
  };

  // Props
  interface Props {
    category: CategoryDefinition;
    annotationGroup: AnnotationGroup<IVideoAnnotationRecord>;
    level: number;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<IVideoAnnotationRecord>) => void;
    onDeleteAnnotation: (annotation: IVideoAnnotationRecord) => void;
  }
  let { category, annotationGroup, level, onSelectAnnotationGroup, onDeleteAnnotation }: Props = $props();

  // Variables
  let { groupId, annotations } = $derived(annotationGroup);
  let lastPartOfGroupId = $derived(groupId.split("-").reverse()[0]);
  let isSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" && v.groupId === groupId;
  });
  let actions = $derived(
    getCategoryActions({ categoryId: category.id, items: annotations, onClickDelete: () => deleteAnnotationGroup() }),
  );

  // function
  function selectAnnotationGroup() {
    selection.selectGroup(groupId);
    onSelectAnnotationGroup(annotationGroup);
  }

  function toggleAnnotationGroupVisibility() {
    getDriver().command.call("annotation.toggle_group_visibility", { groupId });
  }

  function toggleAnnotationGroupEditability() {
    getDriver().command.call("annotation.toggle_group_editability", { groupId });
  }

  function deleteAnnotationGroup() {
    getDriver().command.call("annotation.delete_group", { groupId });
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
        {#each actions as { label, icon, onClick, alwaysShow }, index (index)}
          <CategoryAction
            {label}
            {icon}
            onclick={(e) => {
              e.stopPropagation();
              onClick(e);
            }}
            class={cn({
              "opacity-100": alwaysShow,
              "opacity-0 group-hover:opacity-100": !alwaysShow,
            })}
          ></CategoryAction>
        {/each}
      </div>
    </div>
  </SidebarMenuButton>
</SidebarMenuItem>
