<script lang="ts">
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
  import Logo from "@/components/app/brand/logo.svelte";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    title: string;
    description: string;
    alert?: Snippet;
    content: Snippet;
    footer?: Snippet;
  }
  let { title, description, alert, content, footer }: Props = $props();
</script>

<Card>
  <CardHeader class="flex w-full flex-col items-center">
    <Logo class="mb-4"></Logo>

    <CardTitle>{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>

  <CardContent class="py-4">
    {@render alert?.()}

    {@render content()}
  </CardContent>

  <CardFooter class="flex w-full flex-col items-center">
    {@render footer?.()}
  </CardFooter>
</Card>
