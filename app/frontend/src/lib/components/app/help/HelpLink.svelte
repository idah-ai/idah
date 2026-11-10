<script lang="ts">
  import { InfoIcon } from "@lucide/svelte";

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

<button
  type="button"
  class={cn(
    "text-primary inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium hover:underline",
    active && "underline",
    className,
  )}
  aria-expanded={active}
  onclick={() => toggleHelp(topic)}
>
  <InfoIcon class="size-3.5" />
  {label}
</button>
