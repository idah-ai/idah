<!--
  HistoryChangeCard.svelte — one history row: header + collapsible diff.
  Reference implementation of HISTORY_DIFF_SPEC.md (Svelte 5, runes).
  Styles are scoped plain CSS on purpose: the diff depends on exact pixel values
  (20px rows, 22px sign column, 11.5px mono) that Tailwind utilities tend to drift from.
-->
<script lang="ts">
  import { ChevronDownIcon } from "@lucide/svelte";
  import { diffLines, MAX_LINES, type ChangeEntry, type DiffLine } from "$lib/utils/diff-lines";

  interface Props {
    change: {
      id: string;
      annotation_id: string;
      account_id: number | null;
      account_email: string | null;
      op: "baseline" | "created" | "updated" | "deleted" | "restored";
      version: number;
      changed_at: number;
    };
    /** Category label and colour for the annotation (from driver.config / tombstone). */
    categoryLabel: string;
    categoryColor: string;
    /** The annotation's frame range, e.g. "frames 12–45". */
    frameRange?: string | null;
    /** Its annotation is highlighted on the canvas. */
    highlighted?: boolean;
    /** Arrived with the latest sync: flash once. */
    isNew?: boolean;
    /** The diff payload, fetched lazily when the card is opened. */
    diff?: ChangeEntry[];
    /** True while the diff is being fetched. */
    diffLoading?: boolean;
    open: boolean;
    onToggle: () => void;
  }

  let {
    change,
    categoryLabel,
    categoryColor,
    frameRange = null,
    highlighted = false,
    isNew = false,
    diff,
    diffLoading = false,
    open,
    onToggle,
  }: Props = $props();

  let showAll = $state(false);
  // Built only when opened; recomputed only if the row or showAll changes.
  let lines: DiffLine[] = $derived(open ? diffLines(diff ?? [], showAll ? Infinity : MAX_LINES) : []);

  const shortId = $derived(change.annotation_id.slice(0, 8));
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = $derived(new Date(change.changed_at));
  const time = $derived(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const offsetMin = $derived(-d.getTimezoneOffset());
  const fullTime = $derived(
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}:${pad(d.getSeconds())} (UTC${offsetMin >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)})`,
  );
  const actor = $derived(
    change.account_id === null ? "system" : (change.account_email ?? `account ${change.account_id}`),
  );
</script>

<div class="card" class:card-hl={highlighted} class:card-new={isNew}>
  <button type="button" class="head" class:head-open={open} aria-expanded={open} onclick={onToggle}>
    <span class="row1">
      <span class="op op-{change.op}">{change.op}</span>
      <span class="swatch" style:background={categoryColor}></span>
      <span class="cat">{categoryLabel}</span>
      <span class="spacer"></span>
      <ChevronDownIcon class="chev {open ? '' : 'chev-closed'}" size={12} strokeWidth={2.2} aria-hidden="true" />
    </span>
    {#if frameRange}
      <span class="row2"><span class="fr">{frameRange}</span></span>
    {/if}
    <span class="row3">
      <span class="mono">v{change.version}</span><span>·</span><span class="tnum" title={fullTime}>{time}</span><span
        >·</span
      ><span class="actor">{actor}</span>
    </span>
  </button>

  {#if open}
    {#if diffLoading}
      <div class="diff" role="status">
        <div class="dl dl-ctx"><span class="dl-sign"></span><span class="dl-text">Loading diff…</span></div>
      </div>
    {:else if diff}
      <div class="diff" role="table" aria-label="{change.op} {categoryLabel} {shortId}, version {change.version}">
        {#each lines as line, i (i)}
          {#if line.kind === "more"}
            <button type="button" class="dl dl-more" onclick={() => (showAll = true)}>
              <span class="dl-sign"></span><span class="dl-text">{line.text}</span>
            </button>
          {:else}
            <div class="dl dl-{line.kind}" role="row">
              <span class="dl-sign">{line.sign}</span><span class="dl-text">{line.text}</span>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="diff" role="status">
        <div class="dl dl-ctx"><span class="dl-sign"></span><span class="dl-text">Diff unavailable offline</span></div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Card ─────────────────────────────────────────────────── */
  .card {
    margin: 0 8px 8px;
    box-sizing: border-box;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background: #fff;
    overflow: hidden;
  }
  .card-hl {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px #2563eb;
  }
  .card-new {
    animation: flash 1.6s ease-out;
  }
  @keyframes flash {
    from {
      background: #fef9c3;
    }
    to {
      background: #fff;
    }
  }

  /* ── Header ───────────────────────────────────────────────── */
  .head {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    width: 100%;
    min-height: 54px;
    box-sizing: border-box;
    padding: 0 10px;
    border: 0;
    background: #fafafa;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .head:hover {
    background: #f4f4f5;
  }
  .head:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: -2px;
  }
  .head-open {
    border-bottom: 1px solid #e4e4e7;
  }

  .row1 {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }
  .row2 {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 11.5px;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
  }
  .row3 {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 11px;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
  }

  .mono,
  .op,
  .sid,
  .diff {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .op {
    flex: none;
    font-size: 11px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    line-height: 16px;
  }
  .op-baseline {
    background: #f0f0f1;
    color: #6e7781;
  }
  .op-created {
    background: #dafbe1;
    color: #1a7f37;
  }
  .op-updated {
    background: #ddf4ff;
    color: #0550ae;
  }
  .op-deleted {
    background: #ffebe9;
    color: #cf222e;
  }
  .op-restored {
    background: #fbefff;
    color: #8250df;
  }

  .swatch {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  .cat {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: #18181b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fr {
    flex: none;
    font-variant-numeric: tabular-nums;
  }
  .spacer {
    flex: 1;
  }
  .tnum {
    font-variant-numeric: tabular-nums;
  }
  .actor {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.chev) {
    flex: none;
    color: #71717a;
    transition: transform 0.12s;
  }
  :global(.chev-closed) {
    transform: rotate(-90deg);
  }

  /* ── Diff ─────────────────────────────────────────────────── */
  .diff {
    overflow-x: auto; /* one scrollbar for the whole diff */
    font-size: 11.5px;
    line-height: 20px;
    color: #18181b;
  }
  .dl {
    display: flex;
    width: 100%; /* backgrounds span the card, not the content */
    height: 20px;
  }
  .dl-sign {
    flex: none;
    width: 22px;
    text-align: center;
    user-select: none;
  }
  .dl-text {
    flex: none; /* let the text overflow into the scroll area */
    white-space: pre; /* indentation lives in the text */
    padding-right: 12px;
  }
  .dl-add {
    background: #e6ffec;
  }
  .dl-add .dl-sign {
    background: #ccffd8;
    color: #1a7f37;
  }
  .dl-del {
    background: #ffebe9;
  }
  .dl-del .dl-sign {
    background: #ffd7d5;
    color: #cf222e;
  }
  .dl-ctx {
    color: #57606a;
  }
  .dl-more {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    color: #0550ae;
    text-align: left;
    cursor: pointer;
  }
  .dl-more:hover .dl-text {
    text-decoration: underline;
  }

  /* ── Dark (plugin uses a .dark ancestor) ──────────────────── */
  :global(.dark) .card {
    background: #09090b;
    border-color: #3f3f46;
  }
  :global(.dark) .head {
    background: #18181b;
  }
  :global(.dark) .head:hover {
    background: #27272a;
  }
  :global(.dark) .head-open {
    border-bottom-color: #3f3f46;
  }
  :global(.dark) .cat {
    color: #fafafa;
  }
  :global(.dark) .diff {
    color: #e6edf3;
  }
  :global(.dark) .dl-add {
    background: rgba(46, 160, 67, 0.15);
  }
  :global(.dark) .dl-add .dl-sign {
    background: rgba(63, 185, 80, 0.3);
    color: #3fb950;
  }
  :global(.dark) .dl-del {
    background: rgba(248, 81, 73, 0.1);
  }
  :global(.dark) .dl-del .dl-sign {
    background: rgba(248, 81, 73, 0.3);
    color: #f85149;
  }
  :global(.dark) .dl-ctx {
    color: #9198a1;
  }
  :global(.dark) .op-baseline {
    background: rgba(110, 118, 129, 0.15);
    color: #9198a1;
  }
  :global(.dark) .op-created {
    background: rgba(46, 160, 67, 0.15);
    color: #3fb950;
  }
  :global(.dark) .op-updated {
    background: rgba(56, 139, 253, 0.15);
    color: #58a6ff;
  }
  :global(.dark) .op-deleted {
    background: rgba(248, 81, 73, 0.15);
    color: #f85149;
  }
  :global(.dark) .op-restored {
    background: rgba(163, 113, 247, 0.15);
    color: #bc8cff;
  }
</style>
