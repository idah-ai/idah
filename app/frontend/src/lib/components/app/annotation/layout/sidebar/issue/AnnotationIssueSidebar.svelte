<script lang="ts">
  import AnnotationIssueCard from "@/components/app/annotation/layout/sidebar/issue/AnnotationIssueCard.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarSeparator,
  } from "@/components/ui/sidebar";

  import { XIcon } from "@lucide/svelte";

  // Props
  interface Props {
    open: boolean;
  }
  let { open = $bindable(false) }: Props = $props();

  // Functions
  function closeIssueSidebar() {
    open = false;
  }
</script>

<!-- <SidebarProvider bind:open> -->

{#if open}
  <Sidebar side="right" variant="inset" collapsible="none" class="min-w-80">
    <!-- ANNOTATION::ISSUE::SIDEBAR::HEADER -->
    <SidebarHeader>
      <div class="flex w-full items-center justify-between pl-2">
        <h5 class="text-xl font-semibold">Issues</h5>

        <Button variant="ghost" size="icon" onclick={closeIssueSidebar}>
          <XIcon class="size-4" />
        </Button>
      </div>
    </SidebarHeader>

    <SidebarSeparator />

    <!-- ANNOTATION::ISSUE::SIDEBAR::CONTENT -->
    <SidebarContent class="max-h-[80vh]">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu class="gap-2">
            {#each { length: 10 } as issue, index}
              <SidebarMenuItem>
                <AnnotationIssueCard order={index + 1} />
              </SidebarMenuItem>
            {/each}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
{/if}
