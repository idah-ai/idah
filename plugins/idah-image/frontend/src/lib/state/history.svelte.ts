// ---------------------------------------------------------------------------
// state/history.svelte.ts — History panel state for the image plugin.
//
// History is plugin state, not a driver mode: while it is open the driver mode
// stays whatever it was. `open` is keyed by entry id so moving to another entry
// starts fresh. Closing keeps the current page, scope and opened cards;
// reopening shows them at once and re-queries the backend.
// ---------------------------------------------------------------------------
import { getDriver } from "./driver.svelte";
import { selection } from "./selection.svelte";
import type { IAnnotationChange } from "$idah/v2/types";

const PAGE_SIZE = 50;

export type HistoryScope = { kind: "entry" } | { kind: "annotations"; ids: string[] };

class HistoryState {
  #open = $state(false);
  #page = $state(1);
  #items = $state<IAnnotationChange[]>([]);
  #total = $state(0);
  #loading = $state(false);
  #error = $state<string | null>(null);
  #lastLoadedAt = $state<Date | null>(null);
  #openedCards = $state<Set<string>>(new Set());
  #diffs = $state<Map<string, IAnnotationChange["changes"]>>(new Map());
  #diffLoading = $state<Set<string>>(new Set());
  // The epoch-ms cutoff the current list is anchored to (changed_at__lte), so
  // new changes arriving after a refresh do not shift the pages.
  #anchor = $state<number | null>(null);

  get open() {
    return this.#open;
  }

  get page() {
    return this.#page;
  }

  /** The scope follows the selection reactively: selection is `$state`, so
   *  this recomputes whenever the selected annotation ids change. */
  #scope = $derived(this.#computeScope());

  get scope() {
    return this.#scope;
  }

  /** The annotation ids the current selection resolves to (live, from the
   *  selection store). Used by load() so the filter always matches the current
   *  selection even if the derived scope has not recomputed yet. */
  get selectionAnnotationIds(): string[] {
    return Array.from(selection.selectedAnnotationIds);
  }

  get items() {
    return this.#items;
  }

  get total() {
    return this.#total;
  }

  get loading() {
    return this.#loading;
  }

  get error() {
    return this.#error;
  }

  get lastLoadedAt() {
    return this.#lastLoadedAt;
  }

  get pageCount() {
    return Math.max(1, Math.ceil(this.#total / PAGE_SIZE));
  }

  get pageStart() {
    return this.#total === 0 ? 0 : (this.#page - 1) * PAGE_SIZE + 1;
  }

  get pageEnd() {
    return Math.min(this.#total, this.#page * PAGE_SIZE);
  }

  get isOpen() {
    return this.#open;
  }

  isCardOpen(id: string) {
    return this.#openedCards.has(id);
  }

  getDiff(id: string): IAnnotationChange["changes"] | undefined {
    return this.#diffs.get(id);
  }

  /** True while a card's diff is being fetched. */
  isDiffLoading(id: string): boolean {
    return this.#diffLoading.has(id);
  }

  toggleCard(id: string) {
    const next = new Set(this.#openedCards);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      // Fetch this card's diff on first open (headers are downloaded without
      // the diff payload, so a card's diff is fetched lazily and cached).
      if (!this.#diffs.has(id)) void this.#loadDiff(id);
    }
    this.#openedCards = next;
  }

  async #loadDiff(id: string) {
    const driver = getDriver();
    if (!driver.annotations.changes) return;
    if (this.#diffLoading.has(id)) return;
    this.#diffLoading = new Set(this.#diffLoading).add(id);
    try {
      // Fetch just this change's diff via the list endpoint, filtered to the
      // change id, with the diff payload included.
      const res = await driver.annotations.changes({
        filters: { id__in: [id] },
        size: 1,
        fields: ["annotation_id", "account_id", "account_email", "op", "version", "changed_at", "changes"],
      });
      const detail = res.items[0];
      if (detail?.changes) {
        const next = new Map(this.#diffs);
        next.set(id, detail.changes);
        this.#diffs = next;
      }
    } catch {
      // Leave the diff unavailable; the card shows the offline message.
    } finally {
      const next = new Set(this.#diffLoading);
      next.delete(id);
      this.#diffLoading = next;
    }
  }

  /** The annotation ids the current scope resolves to. */
  get scopeAnnotationIds(): string[] {
    const s = this.#scope;
    if (s.kind === "entry") return [];
    return s.ids;
  }

  /** A stable signature of the current scope, for detecting scope changes. */
  get scopeSignature(): string {
    const s = this.#scope;
    if (s.kind === "entry") return "entry";
    return `a:${s.ids.slice().sort().join(",")}`;
  }

  get scopeLabel(): string {
    const s = this.#scope;
    if (s.kind === "entry") return "Whole entry";
    return `${s.ids.length} annotation${s.ids.length === 1 ? "" : "s"}`;
  }

  toggle() {
    if (this.#open) {
      this.#open = false;
    } else {
      this.#open = true;
      this.#anchor = null;
      this.#page = 1;
      void this.load();
    }
    getDriver().toolbar.invalidate();
  }

  close() {
    if (!this.#open) return;
    this.#open = false;
    getDriver().toolbar.invalidate();
  }

  async load() {
    const driver = getDriver();
    if (!driver.annotations.changes) return;
    this.#loading = true;
    this.#error = null;
    try {
      const ids = this.selectionAnnotationIds;
      const scopeFilter = ids.length ? { annotation_id__in: ids } : {};
      let anchor = this.#anchor;
      if (anchor === null && this.#page === 1) {
        // First open / refresh on page 1: fetch page 1 unanchored and derive
        // the anchor from the newest change, so no separate anchor call is
        // needed. The backend stores changed_at with microsecond precision but
        // returns it truncated to whole seconds, so add a 1-second inclusive
        // epsilon so the changedAtLte bound still includes the newest change.
        const first = await driver.annotations.changes({
          filters: scopeFilter,
          page: 1,
          size: PAGE_SIZE,
        });
        anchor = (first.items[0]?.changed_at ?? Date.now()) + 1000;
        this.#anchor = anchor;
        this.#applyPage(first);
        return;
      }
      if (anchor === null) {
        // Refresh on a later page: re-anchor to the newest change, then load
        // the current page against it.
        const first = await driver.annotations.changes({
          filters: scopeFilter,
          page: 1,
          size: 1,
        });
        anchor = (first.items[0]?.changed_at ?? Date.now()) + 1000;
        this.#anchor = anchor;
      }
      const result = await driver.annotations.changes({
        filters: { ...scopeFilter, changed_at__lte: anchor },
        page: this.#page,
        size: PAGE_SIZE,
      });
      this.#applyPage(result);
    } catch (e) {
      this.#error = e instanceof Error ? e.message : String(e);
    } finally {
      this.#loading = false;
    }
  }

  /** Store a fetched page and clamp the page. */
  #applyPage(result: { items: IAnnotationChange[]; total: number }) {
    this.#items = result.items;
    this.#total = result.total;
    this.#lastLoadedAt = new Date();
    // Clamp the page to the new last page after a refresh.
    if (this.#page > this.pageCount) this.#page = this.pageCount;
    // Drop the diff cache and opened-card state for changes that are no longer
    // on this page, so browsing history does not accumulate memory unboundedly.
    // Only the current page's cards keep their (lazily fetched) diffs.
    const visible = new Set(result.items.map((c) => c.id));
    this.#openedCards = new Set(Array.from(this.#openedCards).filter((id) => visible.has(id)));
    this.#diffs = new Map(Array.from(this.#diffs).filter(([id]) => visible.has(id)));
    this.#diffLoading = new Set(Array.from(this.#diffLoading).filter((id) => visible.has(id)));
  }

  async refresh() {
    this.#anchor = null;
    await this.load();
  }

  goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, this.pageCount));
    if (clamped === this.#page) return;
    this.#page = clamped;
    void this.load();
  }

  /** Reset to page 1 without triggering a load (used on scope changes). */
  resetPage() {
    this.#page = 1;
  }

  goToNewest() {
    this.goToPage(1);
  }

  goToOldest() {
    this.goToPage(this.pageCount);
  }

  /** Build the scope from the current selection. */
  #computeScope(): HistoryScope {
    const annIds = Array.from(selection.selectedAnnotationIds);
    if (annIds.length === 0) {
      return { kind: "entry" };
    }
    return { kind: "annotations", ids: annIds };
  }
}

export const history = new HistoryState();