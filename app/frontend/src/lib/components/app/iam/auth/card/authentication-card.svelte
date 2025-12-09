<script lang="ts">
  import Logo from "@/components/app/brand/logo.svelte";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    title: string;
    description: string;
    alert?: Snippet;
    responseBlock?: Snippet;
    content: Snippet;
    footer?: Snippet;
  }
  let { title, description, alert, responseBlock, content, footer }: Props = $props();
</script>

<Card>
  <CardHeader class="flex w-full flex-col items-center text-center">
    <Logo class="h-16 w-24" />

    {@render responseBlock?.()}

    <CardTitle>{title}</CardTitle>
    <CardDescription class="text-center">{description}</CardDescription>
  </CardHeader>

  <CardContent class="py-4">
    {@render alert?.()}

    {@render content()}
  </CardContent>

  {#if footer}
    <CardFooter class="flex w-full flex-col items-center">
      {@render footer?.()}
    </CardFooter>
  {/if}
</Card>
