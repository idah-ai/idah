<script lang="ts">
  interface Props {
    text: string | null | undefined;
    query: string;
  }

  let { text = "", query }: Props = $props();

  const parts = $derived.by<Array<{ value: string; highlight: boolean }>>(() => {
    const t = text ?? "";
    if (!query || query.trim() === "") return [{ value: t, highlight: false }];

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const result: Array<{ value: string; highlight: boolean }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(t)) !== null) {
      if (match.index > lastIndex) {
        result.push({ value: t.slice(lastIndex, match.index), highlight: false });
      }
      result.push({ value: match[0], highlight: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < t.length) {
      result.push({ value: t.slice(lastIndex), highlight: false });
    }

    return result.length > 0 ? result : [{ value: t, highlight: false }];
  });
</script>

{#each parts as part (part.value + part.highlight)}
  {#if part.highlight}
    <strong class="font-semibold underline">{part.value}</strong>
  {:else}
    {part.value}
  {/if}
{/each}
