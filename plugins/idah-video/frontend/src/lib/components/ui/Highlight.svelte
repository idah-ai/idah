<script lang="ts">
  interface Props {
    text: string | null | undefined;
    query: string;
  }

  let { text = "", query }: Props = $props();

  const parts = $derived.by<Array<{ value: string; highlight: boolean }>>(() => {
    if (!query || query.trim() === "") return [{ value: text, highlight: false }];

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const result: Array<{ value: string; highlight: boolean }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ value: text.slice(lastIndex, match.index), highlight: false });
      }
      result.push({ value: match[0], highlight: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({ value: text.slice(lastIndex), highlight: false });
    }

    return result.length > 0 ? result : [{ value: text, highlight: false }];
  });
</script>

{#each parts as part (part.value + part.highlight)}
  {#if part.highlight}
    <strong class="underline font-semibold">{part.value}</strong>
  {:else}
    {part.value}
  {/if}
{/each}
