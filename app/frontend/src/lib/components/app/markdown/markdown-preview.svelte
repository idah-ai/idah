<script lang="ts">
  import { marked } from "marked";

  import { cn } from "@/utils";

  // Props
  interface Props {
    value: string | null;
    class?: string | null;
  }
  let { value, class: className }: Props = $props();

  // Variables
  // const renderer = {
  //   heading(token: Tokens.Heading) {},
  // };

  // Functions
  function parseMarkdown(text: string): string {
    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      breaks: true,
    });

    // marked.use({renderer})

    return marked.parse(text).toString();
  }
</script>

<div class={cn("", className)}>
  {@html parseMarkdown(value ?? "")}
</div>
