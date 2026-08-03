<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";

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

    const html = marked.parse(text).toString();

    // dompurify needs a DOM; the app is SSR (adapter-node). Sanitise in the
    // browser only — server render yields "" until hydration re-runs this.
    return typeof window !== "undefined" ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : "";
  }
</script>

<div class={cn("", className)}>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html parseMarkdown(value ?? "")}
</div>
