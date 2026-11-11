<script lang="ts">
  import { InfoIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";

  import { cn } from "@/utils";

  import { help, registerHelpLink, toggleHelp } from "./help.svelte";

  // A small "Info" link that opens a help topic in the side panel; drop it next to anything
  // that needs explaining. Clicking it again closes the panel.
  interface Props {
    topic: string; // a file in ./topics, without ".md"
    label?: string;
    class?: string;
  }
  let { topic, label = "Info", class: className }: Props = $props();

  const active = $derived(help.topic === topic);

  // While this link is on the page its topic stays relevant; the panel closes once it's gone.
  $effect(() => registerHelpLink(topic));
</script>

<Button
  type="button"
  variant="link"
  size="sm"
  class={cn("h-auto gap-1 px-0 has-[>svg]:px-0", active && "underline", className)}
  aria-expanded={active}
  onclick={() => toggleHelp(topic)}
>
  <InfoIcon />
  {label}
</Button>
