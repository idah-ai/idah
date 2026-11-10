<script lang="ts">
  import { MapPinIcon, MessageCircleIcon, MessageSquareIcon, SquareDashedIcon, type LucideIcon } from "@lucide/svelte";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";

  import { cn } from "@/utils";
  import type { NoteFeedType } from "@/data/model/dataset/notes/feeds/record";

  interface Props {
    noteType: NoteFeedType;
  }
  let { noteType }: Props = $props();

  interface NoteTypeProp {
    label: string;
    class: string;
    icon: LucideIcon;
  }

  const noteTypeProp = $derived.by<NoteTypeProp>(() => {
    switch (noteType) {
      case "entry": {
        return {
          label: "Entry note",
          class: "bg-emerald-200 text-emerald-900 dark:bg-emerald-400",
          icon: MessageCircleIcon,
        };
      }
      case "annotation": {
        return {
          label: "Annotation note",
          class: "bg-purple-200 text-purple-900 dark:bg-purple-400",
          icon: SquareDashedIcon,
        };
      }
      case "pin": {
        return {
          label: "Pin note",
          class: "bg-yellow-200 text-yellow-900 dark:bg-yellow-400",
          icon: MapPinIcon,
        };
      }
      default: {
        return {
          label: "Note",
          class: "bg-secondary",
          icon: MessageSquareIcon,
        };
      }
    }
  });
</script>

<Tooltips align="center">
  {#snippet trigger()}
    <div class={cn("flex size-8 shrink-0 items-center justify-center rounded-full", noteTypeProp.class)}>
      <noteTypeProp.icon class="size-3.5" />
    </div>
  {/snippet}

  {#snippet content()}
    {noteTypeProp.label}
  {/snippet}
</Tooltips>
