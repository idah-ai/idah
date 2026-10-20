// ---------------------------------------------------------------------------
// note-refresh.ts — Wrap an annotation driver so note-list refreshes fire
// after annotation delete/restore.
//
// When an annotation is soft-deleted or restored, notes anchored to it may
// change their "Annotation deleted" state. The host detects these mutations
// (plugins never call the backend directly) and bumps `refetches.noteFeeds.list`
// so the sidebar re-fetches notes and the badge stays current without a reload.
//
// Refreshing is debounced because a merge deletes several pieces in a row and
// should trigger a single refetch.
// ---------------------------------------------------------------------------
import type { IAnnotationsDriverV2 } from "../../types";
import type { ICrudDriver } from "./idb-driver";

type NoteRefreshDriver = ICrudDriver<{ id: string }> | IAnnotationsDriverV2;

/**
 * Wrap `driver` so that a successful `delete`/`restore` calls `refreshNotes`
 * (after the backend call resolves). Rejected calls do not refresh and still
 * reject to the caller.
 *
 * The driver is mutated in place (its `delete`/`restore` are overridden with
 * bound originals) and the same object is returned, so class instances keep
 * all their other methods (fetch, create, update, setShape, …).
 */
export function withNoteRefresh<TDriver extends NoteRefreshDriver>(driver: TDriver, refreshNotes: () => void): TDriver {
  const originalDelete = driver.delete.bind(driver);
  const originalRestore = driver.restore.bind(driver);

  driver.delete = (async (id: string): Promise<void> => {
    await originalDelete(id);
    refreshNotes();
  }) as TDriver["delete"];

  driver.restore = (async (id: string): Promise<unknown> => {
    const result = await originalRestore(id);
    refreshNotes();
    return result;
  }) as TDriver["restore"];

  return driver;
}
