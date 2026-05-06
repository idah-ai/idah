<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import { SidebarMenuButton, SidebarMenuItem } from "$lib/components/ui/Sidebar";

  import { cn } from "$lib/utils";

  import Icon from "$lib/components/ui/Icon";
  import CategoryAction from "$lib/components/Layout/Sidebar/Category/CategoryAction.svelte";
  import CategoryName from "$lib/components/Layout/Sidebar/Category/CategoryName.svelte";

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";

  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    name: string;
    annotation: VideoAnnotationObject;
    level: number;
    onSelectAnnotation: (annotation: VideoAnnotationObject) => void;
    onVisibility: (hidden: boolean, annotation?: VideoAnnotationObject) => void;
    onLock: (locked: boolean, annotation?: VideoAnnotationObject) => void;
    onDeleteAnnotation: (annotation: VideoAnnotationObject) => void;
  }
  let { name, annotation, level, onSelectAnnotation, onVisibility, onLock, onDeleteAnnotation }: Props = $props();
</script>

<SidebarMenuItem class="list-none">
  <SidebarMenuButton
    class={cn("group w-full gap-0 pr-0 hover:cursor-pointer")}
    onclick={() => onSelectAnnotation(annotation)}
  >
    <div class="flex w-full items-center gap-1 text-xs" style="padding-left: {Number(level - 1) + 0.5}rem">
      <div class="shrink-0">
        {#if annotation.shape.type === IDAH_VIDEO_BOUNDING_BOX}
          <Icon src={vectorSquareIconSvg} />
        {:else if annotation.shape.type === IDAH_VIDEO_POLYGON}
          <Icon src={polygonIconSvg} />
        {/if}
      </div>

      <CategoryName {name} />

      <!-- BUTTON::HIDE/SHOW, LOCK/UNLOCK, DROPDOWN ACTIONS -->
      <div class="ml-auto flex items-center gap-0">
        <CategoryAction
          class={cn({
            block: annotation.hidden,
            "hidden group-hover:block": !annotation.hidden,
          })}
          onclick={() => onVisibility(!annotation.hidden, annotation)}
        >
          {@const VisibilityIcon = annotation.hidden ? EyeOffIcon : EyeIcon}
          <VisibilityIcon />
        </CategoryAction>

        <!-- BUTTON::LOCK & UNLOCK ANNOTATION -->
        <CategoryAction
          class={cn({
            block: annotation.locked,
            "hidden group-hover:block": !annotation.locked,
          })}
          onclick={() => onLock(!annotation.locked, annotation)}
        >
          {@const EditabilityIcon = annotation.locked ? LockIcon : LockOpenIcon}
          <EditabilityIcon />
        </CategoryAction>

        <CategoryAction class="hidden group-hover:block" onclick={() => onDeleteAnnotation(annotation)}>
          <Trash2Icon />
        </CategoryAction>
      </div>
    </div>
  </SidebarMenuButton>
</SidebarMenuItem>
