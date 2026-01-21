<script lang="ts">
  import CodeSnippet from "$lib/app/snippet/code-snippet.svelte";
  import TabsContent from "$lib/components/ui/tabs/tabs-content.svelte";
  import TabsList from "$lib/components/ui/tabs/tabs-list.svelte";
  import TabsTrigger from "$lib/components/ui/tabs/tabs-trigger.svelte";
  import Tabs from "$lib/components/ui/tabs/tabs.svelte";

  interface TabCodeSnippetProps {
    value: string;
    code: string;
  }

  interface TabCodeSnippetsProps {
    value: string;
    items: TabCodeSnippetProps[];
  }

  let { value, items }: TabCodeSnippetsProps = $props();
</script>

<Tabs {value} class="w-[420px]">
  <TabsList class="rounded-lg bg-muted p-1">
    {#each items as item}
      <TabsTrigger value={item.value} class="rounded-md px-3 text-sm">
        {item.value}
      </TabsTrigger>
    {/each}
  </TabsList>

  {#each items as item}
    <TabsContent value={item.value}>
      <CodeSnippet code={item.code} />
    </TabsContent>
  {/each}
</Tabs>
