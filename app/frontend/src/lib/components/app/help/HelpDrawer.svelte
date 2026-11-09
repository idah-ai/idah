<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { fly } from "svelte/transition";

  import { Button } from "@/components/ui/button";

  import { closeHelp, help, openHelp } from "./help.svelte";
  import { renderHelp } from "./help-markdown";
  import { helpTopics } from "./help-topics";

  // Mounted once in the root layout. Not a dialog: it sits beside the page (and above any
  // open modal, which marks it as an allowed outside area) so users can read and act at once.
  // An open modal sets pointer-events: none on <body>; the drawer opts back in.
  const topic = $derived(help.topic ? helpTopics[help.topic] : undefined);

  // On wide screens the drawer pushes the page (and centred modals) aside instead of covering
  // them: --help-drawer-width is the room it takes. On narrow screens it overlays.
  const WIDTH = "24rem"; // sm:max-w-sm
  const wide = new MediaQuery("min-width: 1024px");
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty("--help-drawer-width", help.open && wide.current ? WIDTH : "0px");
    return () => root.style.removeProperty("--help-drawer-width");
  });
  // Topics are our own Markdown files, never user input.
  const html = $derived(topic ? renderHelp(topic.body) : "");

  // A link to "#help:other-topic" opens that topic in place.
  function handleClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href");
    if (!href?.startsWith("#help:")) return;
    event.preventDefault();
    openHelp(href.slice("#help:".length));
  }

  // Listened to in code: the body is plain content, not an interactive element.
  let body = $state<HTMLDivElement>();
  $effect(() => {
    body?.addEventListener("click", handleClick);
    return () => body?.removeEventListener("click", handleClick);
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && help.open) closeHelp();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if help.open}
  <aside
    data-help-drawer
    aria-label="Help"
    class="bg-background pointer-events-auto fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l shadow-lg sm:max-w-sm"
    transition:fly={{ x: 384, duration: 200 }}
  >
    <header class="flex items-center gap-2 border-b px-5 py-4">
      <h2 class="min-w-0 flex-1 truncate text-base font-semibold">{topic?.title ?? "Help"}</h2>
      <Button variant="ghost" size="icon-sm" aria-label="Close help" onclick={closeHelp}>
        <XIcon />
      </Button>
    </header>

    <!-- clicks are delegated here so "#help:topic" links open that topic -->
    <div
      bind:this={body}
      class={[
        "flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed",
        "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2:first-child]:mt-0",
        "[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-medium",
        "[&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_pre]:bg-muted [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_pre_code]:p-0",
        "[&_blockquote]:text-muted-foreground [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        "help-body",
        "[&_table]:mb-3 [&_table]:w-full [&_td]:border-b [&_td]:py-1 [&_th]:border-b [&_th]:py-1 [&_th]:text-left",
        "[&_img]:mb-3 [&_img]:rounded-md [&_img]:border",
      ]}
    >
      {#if topic}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own Markdown files -->
        {@html html}
      {:else}
        <p class="text-muted-foreground">No help is available for this topic yet.</p>
      {/if}
    </div>
  </aside>
{/if}

<!-- The custom blocks of help-markdown.ts: file trees, "You pick → You get" examples, callouts. -->
<style>
  .help-body :global(.help-tree) {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: color-mix(in oklab, var(--muted) 40%, transparent);
    font-size: 0.75rem;
  }
  .help-body :global(.help-tree-row) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0;
    padding-block: 0.125rem;
  }
  .help-body :global(.help-tree-icon) {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--muted-foreground);
  }
  .help-body :global(.help-tree-name) {
    font-family: var(--font-mono, ui-monospace, monospace);
  }
  .help-body :global(.help-tree-note) {
    margin-left: auto;
    padding-left: 0.5rem;
    color: var(--muted-foreground);
    font-style: italic;
  }
  .help-body :global(.help-example) {
    margin: 0 0 1rem;
  }
  .help-body :global(.help-example-caption) {
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .help-body :global(.help-example-section .help-tree) {
    margin-bottom: 0;
  }
  .help-body :global(.help-example-arrow) {
    padding-block: 0.25rem;
    text-align: center;
    color: var(--muted-foreground);
  }
  .help-body :global(.help-callout) {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-left-width: 3px;
    border-radius: 0.375rem;
    color: var(--foreground);
  }
  .help-body :global(.help-callout p:last-child) {
    margin-bottom: 0;
  }
  .help-body :global(.help-callout-note),
  .help-body :global(.help-callout-tip) {
    border-left-color: var(--primary);
    background: color-mix(in oklab, var(--primary) 6%, transparent);
  }
  .help-body :global(.help-callout-warning) {
    border-left-color: #d97706;
    background: color-mix(in oklab, #f59e0b 10%, transparent);
  }
</style>
