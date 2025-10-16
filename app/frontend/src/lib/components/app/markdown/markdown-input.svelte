<script lang="ts">
  import {
    BoldIcon,
    CodeIcon,
    EllipsisVerticalIcon,
    HeadingIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    TextQuoteIcon,
  } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
    InputGroupTextarea,
  } from "@/components/ui/input-group";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Toggle from "@/components/ui/toggle/toggle.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Elements
  let TabsComponent: HTMLElement | null = $state(null);

  // Variables
  let currentTab = $state("write");
  const tabs = [
    { label: "Write", value: "write" },
    { label: "Preview", value: "preview" },
  ];

  const headingTool = { label: "Heading", value: "heading", icon: HeadingIcon };
  const boldTool = { label: "Bold", value: "bold", icon: BoldIcon };
  const smallTools = [headingTool, boldTool];
  const mediumTools = [headingTool, boldTool];
  const largeTools = [headingTool, boldTool];

  const toolsDropdown: IDropdownMenus = {
    // headings: {
    //   label: "Headings",
    //   items: [
    //     { label: "Heading", icon: HeadingIcon },
    //     { label: "Bold", icon: BoldIcon },
    //   ],
    // },
    general: {
      items: [
        { label: "Italic", icon: ItalicIcon },
        { label: "Quote", icon: TextQuoteIcon },
        { label: "Code", icon: CodeIcon },
        { label: "Link", icon: LinkIcon },
      ],
    },
    lists: {
      label: "Lists",
      items: [
        { label: "Numbered list", icon: ListOrderedIcon },
        { label: "Unordered list", icon: ListIcon },
      ],
    },
  };
</script>

<Tabs bind:ref={TabsComponent} bind:value={currentTab} class="w-full">
  <InputGroup class="bg-background">
    <InputGroupAddon align="block-start" class="border-b">
      <TabsList>
        {#each tabs as { label, value } (value)}
          <TabsTrigger {value}>{label}</TabsTrigger>
        {/each}
      </TabsList>

      {#if currentTab === "write"}
        <div class="ml-auto">
          {#if (TabsComponent as unknown as HTMLElement)?.clientWidth > 800}
            {#each largeTools as { label, icon: Icon } (label)}
              <Toggle size="sm" aria-label="Toggle {label}">
                <Icon class="size-4" />
              </Toggle>
            {/each}
          {:else if (TabsComponent as unknown as HTMLElement)?.clientWidth > 400}
            {#each mediumTools as { label, icon: Icon } (label)}
              <Toggle size="sm" aria-label="Toggle {label}">
                <Icon class="size-4" />
              </Toggle>
            {/each}
          {:else}
            {#each smallTools as { label, icon: Icon } (label)}
              <Toggle size="sm" aria-label="Toggle {label}">
                <Icon class="size-4" />
              </Toggle>
            {/each}

            <DropdownMenus menus={toolsDropdown} align="end">
              {#snippet trigger({ props })}
                <Button {...props} variant="ghost" size="icon" class="size-8">
                  <EllipsisVerticalIcon />
                </Button>
              {/snippet}
            </DropdownMenus>
          {/if}
        </div>
      {/if}
    </InputGroupAddon>

    <TabsContent value="write" class="w-full">
      <InputGroupTextarea placeholder="Write your markdown here..."></InputGroupTextarea>
      <InputGroupAddon align="block-end" class="border-t">
        <InputGroupButton class="ml-auto" size="sm" variant="default">Submit</InputGroupButton>
      </InputGroupAddon>
    </TabsContent>

    <TabsContent value="preview" class="w-full">
      <MarkdownPreview />
    </TabsContent>
  </InputGroup>
</Tabs>
