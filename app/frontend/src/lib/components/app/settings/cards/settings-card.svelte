<script lang="ts">
  import type { Snippet } from "svelte";

  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Separator } from "@/components/ui/separator";

  // Props
  interface Props {
    title: string;
    description?: string;
    children?: Snippet;
  }
  let { title, description, children }: Props = $props();
</script>

<Card class="bg-background gap-3 rounded-none border-0 p-0 shadow-none">
  <CardHeader class="px-0 pb-0">
    <CardTitle>{title}</CardTitle>

    <Separator class="mt-2" />

    {#if description}
      <CardDescription>{description}</CardDescription>
    {/if}
  </CardHeader>

  <CardContent class="flex flex-col gap-2 px-0">
    {@render children?.()}
  </CardContent>
</Card>
