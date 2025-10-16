<script lang="ts">
  import { CheckIcon, EllipsisVerticalIcon, MapPinIcon, MessageSquareIcon, SquareDashedIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  // import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  // import { Card, CardAction, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";

  import { cn } from "@/utils";
  import { truncate } from "@/utils/string";

  import { commentsSidebarStore } from "./comments-sidebar-stores";

  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteFeed: INoteFeed;
  }
  let { noteFeed }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let {
    id,
    // entry_id,
    annotation_id,
    created_by_id,
    anchor_type,
    position,
    status,
    content_md,
    created_at,
  } = $derived(noteFeed);

  type CommentType = "general" | "annotation" | "video_frame";
  let commentType: CommentType = $derived.by(() => {
    if (annotation_id) return "annotation";
    if (Object.keys(position || {}).length > 0) return "video_frame";
    return "general";
  });

  let isResolved = $derived(status === "resolved");

  // Functions
  function handleClickNoteFeedCard() {
    console.log("Click NoteFeedCard", id);
  }

  async function markAsResolved() {
    await context.notes.markAsResolved(id);
    toast.success("Comment marked as resolved");
    $commentsSidebarStore.lastUpdated = new Date();
  }
</script>

<!-- <Card
  class="shadow-xs hover:bg-primary/10 hover:border-primary group cursor-pointer py-4"
  onclick={handleClickNoteFeedCard}
>
  <CardContent class="flex flex-col gap-2 px-4">
    <div class="flex w-full flex-row items-center gap-1">
      <CardTitle>Comment #1</CardTitle>
      <CardDescription>(Frame 15)</CardDescription>

      <CardAction class="ml-auto">
        <Tooltips align="center">
          {#snippet trigger()}
            <Button
              variant="ghost"
              size="icon"
              class="group-hover:hover:bg-primary/20 size-6 rounded-full"
              onclick={markAsResolved}
            >
              <CheckIcon class="size-3" />
            </Button>
          {/snippet}

          {#snippet content()}
            Mark as Resolved
          {/snippet}
        </Tooltips>

        <DropdownMenus menus={{}}>
          {#snippet trigger()}
            <Button variant="ghost" size="icon" class="group-hover:hover:bg-primary/20 size-6 rounded-full">
              <EllipsisVerticalIcon class="size-3" />
            </Button>
          {/snippet}
        </DropdownMenus>
      </CardAction>
    </div>

    <div class="flex w-full items-center gap-2">
      <Avatar>
        <AvatarImage></AvatarImage>
        <AvatarFallback class="text-xs">{created_by_id}</AvatarFallback>
      </Avatar>

      <div class="flex flex-col gap-0">
        <CardTitle>Account ID: {created_by_id}</CardTitle>
        <CardDescription class="text-xs">
          <DateText
            datetime={new Date(created_at)}
            datetimeFormat="MMM dd, yyyy HH:mm:ss"
            size="xs"
            weight="normal"
            showDistance
            showTooltip
          ></DateText>
        </CardDescription>
      </div>
    </div>

    <div class="ml-10 text-left">
      <p>{content_md}</p>
    </div>
  </CardContent>
</Card> -->

<button
  class={cn("border-1 group flex flex-col gap-2 rounded-lg border-transparent p-2", {
    "hover:border-purple-500 hover:bg-purple-100": commentType === "annotation",
    "hover:border-yellow-500 hover:bg-yellow-100": commentType === "video_frame",
    "hover:border-red-500 hover:bg-red-100": commentType === "general",
  })}
  onclick={handleClickNoteFeedCard}
>
  <!-- HEADER -->
  <div class="flex w-full gap-2">
    <!-- HEADER::TITLE -->
    <div class="flex flex-1 items-center gap-2">
      <div
        class={cn("flex size-8 shrink-0 items-center justify-center rounded-full ", {
          "bg-purple-300": commentType === "annotation",
          "bg-yellow-300": commentType === "video_frame",
          "bg-red-300": commentType === "general",
        })}
      >
        {#if commentType === "annotation"}
          <SquareDashedIcon class="size-3.5" />
        {:else if commentType === "video_frame"}
          <MapPinIcon class="size-3.5" />
        {:else if commentType === "general"}
          <MessageSquareIcon class="size-3.5" />
        {/if}
      </div>

      <div class="flex flex-col -space-y-1 text-left">
        <p class="font-semibold">{created_by_id}@email.com</p>
        <DateText
          class="text-muted-foreground"
          datetime={new Date(created_at)}
          datetimeFormat="MMM dd, yyyy HH:mm:ss"
          size="xs"
          weight="normal"
          showDistance
          showTooltip
        ></DateText>
      </div>
    </div>

    <!-- HEADER::ACTIONS -->
    <div class="flex items-center">
      <!-- HEADER::ACTIONS::MARK AS RESOLVED -->

      {#if !isResolved}
        <Tooltips align="center">
          {#snippet trigger()}
            <Button
              variant="ghost"
              size="icon"
              class="group-hover:hover:bg-muted size-6 rounded-full"
              onclick={(e) => {
                e.stopPropagation();
                markAsResolved();
              }}
            >
              <CheckIcon class="size-3" />
            </Button>
          {/snippet}

          {#snippet content()}
            Mark as Resolved
          {/snippet}
        </Tooltips>
      {/if}

      <!-- HEADER::ACTIONS::DROPDOWN -->
      <DropdownMenus menus={{}}>
        {#snippet trigger()}
          <Button variant="ghost" size="icon" class="group-hover:hover:bg-muted size-6 rounded-full">
            <EllipsisVerticalIcon class="size-3" />
          </Button>
        {/snippet}
      </DropdownMenus>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex min-h-16 flex-1 flex-col gap-2 text-left text-sm">
    <p>{truncate(content_md, 100)}</p>
  </div>
</button>
