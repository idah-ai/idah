<script lang="ts">
  import { CheckIcon, EllipsisVerticalIcon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardAction, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import type { INoteFeed } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteFeed: INoteFeed;
  }
  let { noteFeed }: Props = $props();

  // Functions
  function markAsResolved() {
    console.log("Mark as Resolved");
  }
</script>

<Card class="shadow-xs hover:bg-primary/10 hover:border-primary group cursor-pointer py-4">
  <CardContent class="flex flex-col items-center gap-2 px-4">
    <!-- HEADER -->
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

    <!-- CONTENT::AVATAR -->
    <div class="flex w-full items-center gap-2">
      <Avatar>
        <AvatarImage></AvatarImage>
        <AvatarFallback class="text-xs">CN</AvatarFallback>
      </Avatar>

      <div class="flex flex-col gap-0">
        <CardTitle>Alex Johnson</CardTitle>
        <CardDescription class="text-xs">1 day ago</CardDescription>
      </div>
    </div>

    <!-- CONTENT::COMMENT -->
    <div class="ml-10">
      <p>This annotation is not good, need to be fix</p>
    </div>
  </CardContent>
</Card>
