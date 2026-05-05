<script lang="ts">
  import { SquareSplitHorizontalIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";
  import { getContext } from "svelte";

  import Button from "$lib/components/ui/button/button.svelte";
  import Separator from "$lib/components/ui/separator/separator.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { ContextMenuComponentProps } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";
  import type { Menus } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.types";
  import type { TimelineItem } from "$lib/plugin/video-annotation-activity/timeline/types";

  // Props
  interface Props extends ContextMenuComponentProps {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let menus = $state<Menus>({
    keyframe: {
      items: {
        // seek: {
        //   label: `Seek to frame`,
        //   icon: SearchIcon,
        //   visible: false,
        //   disabled: false,
        //   onClick: () => {
        //     onSeekFrame(displayScaledFrame);
        //   },
        // },
        split: {
          label: `Split at frame: `,
          icon: SquareSplitHorizontalIcon,
          hidden: false,
          disabled: false,
          onClick: () => {
            // context.commands.run("annotation.split", {
            //   id: closestAnnotation.metadata.id,
            //   at: displayScaledFrame,
            // });
          },
        },
        deleteKeyframe: {
          label: `Delete keyframe: `,
          icon: Trash2Icon,
          hidden: false,
          disabled: false,
          destructive: true,
          onClick: () => {
            //     context.commands.run("annotation.delete", {
            //   annotationId: closestAnnotation.metadata.id,
            // });
            // selectAnnotationGroup.annotations = selectAnnotationGroup.annotations.filter(
            //   (annotation) => annotation.metadata.id !== closestAnnotation.metadata.id,
            // );
            // if (selectAnnotationGroup.annotations.length > 0) {
            //   /** Select the new closest annotation after filter the deleted annotation */
            //   selectClosestAnnotation(selectAnnotationGroup, $currentFrame);
            // } else {
            //   context.commands.run("tools.reset");
            // }
          },
        },
      },
    },
    annotation: {
      items: {
        delete: {
          label: `Delete annotation`,
          icon: Trash2Icon,
          hidden: false,
          disabled: false,
          destructive: true,
          onClick: () => {
            console.log("TODO::Handle Delete Annotation");
          },
        },
      },
    },
  });
</script>

<div class="bg-background my-1 flex flex-col">
  {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
    {@const isLastGroup = Object.keys(menus).length - 1 === groupIndex}

    {#each Object.entries(group.items) as [menuKey, { label, icon: Icon, disabled, hidden, destructive, onClick }] (menuKey)}
      {#if !hidden}
        <Button
          variant={destructive ? "destructive-ghost" : "ghost"}
          size="sm"
          class="mx-1 justify-start"
          {disabled}
          onclick={onClick}
        >
          <Icon />
          {label}
        </Button>
      {/if}
    {/each}

    {#if !isLastGroup && Object.keys(group.items).length > 0}
      <Separator class="my-1" />
    {/if}
  {/each}
</div>
