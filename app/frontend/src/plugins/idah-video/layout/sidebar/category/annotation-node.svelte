<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

  import { cn } from "@/utils";

  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";

  import CategoryAction from "./category-action.svelte";
  import CategoryName from "./category-name.svelte";
  import { IDAH_VIDEO_POLYGON, IDAH_VIDEO_BOUNDING_BOX } from "../../../type";
  import VectorSquareSvg from "../../../../assets/icons/vector-square.svg?raw";
  import PolygonSvg from "../../../../assets/icons/polygon.svg?raw";

  // Props
  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;
  interface Props {
    name: string;
    annotation: TAnnotationObj;
    level: number;
    onSelectAnnotation: (annotation: TAnnotationObj) => void;
    onVisibility: (hidden: boolean, annotation?: TAnnotationObj) => void;
    onLock: (locked: boolean, annotation?: TAnnotationObj) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj) => void;
  }
  let { name, annotation, level, onSelectAnnotation, onVisibility, onLock, onDeleteAnnotation }: Props = $props();
</script>

<SidebarMenuItem class="list-none">
  <SidebarMenuButton
    class={cn("group w-full gap-0 pr-0 hover:cursor-pointer")}
    onclick={() => onSelectAnnotation(annotation)}
  >
    <div class="flex w-full items-center gap-1 text-xs" style="padding-left: {Number(level - 1) + 0.5}rem">
      <div class="shrink-0" style="color: {'var(--color-gray-500)'}">
        {#if annotation.shape.type === IDAH_VIDEO_BOUNDING_BOX}
          <!-- VECTOR SQUARE ICON -->
          {@html VectorSquareSvg}
        {:else if annotation.shape.type === IDAH_VIDEO_POLYGON}
          <!-- POLYGON CIRCLE ICON -->
          {@html PolygonSvg}
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
          <svelte:component this={annotation.hidden ? EyeOffIcon : EyeIcon} />
        </CategoryAction>

        <!-- BUTTON::LOCK & UNLOCK ANNOTATION -->
        <CategoryAction
          class={cn({
            block: annotation.locked,
            "hidden group-hover:block": !annotation.locked,
          })}
          onclick={() => onLock(!annotation.locked, annotation)}
        >
          <svelte:component this={annotation.locked ? LockIcon : LockOpenIcon} />
        </CategoryAction>

        <CategoryAction class="hidden group-hover:block" onclick={() => onDeleteAnnotation(annotation)}>
          <Trash2Icon />
        </CategoryAction>
      </div>
    </div>
  </SidebarMenuButton>
</SidebarMenuItem>
