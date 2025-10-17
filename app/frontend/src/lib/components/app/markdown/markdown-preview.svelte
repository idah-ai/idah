<script lang="ts">
  import { marked } from "marked";

  // Props
  interface Props {
    value: string | null;
  }
  let { value }: Props = $props();

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

{@html parseMarkdown(value ?? "")}
