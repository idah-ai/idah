// ---------------------------------------------------------------------------
// write-tile-entries.ts — Shared helper for writing tile entries via
// setShape/setShapes, consolidating the "batch vs single" branching that
// was duplicated across multiple commands.
// ---------------------------------------------------------------------------

/**
 * Write tile entries to the annotation store, using setShapes when there are
 * multiple entries and setShape for a single entry.
 *
 * @param annotations - The annotations driver (must have setShape and setShapes)
 * @param annotationId - The annotation to write tiles for
 * @param entries - Array of { key, value } pairs. value can be null to delete.
 */
export async function writeTileEntries(
  annotations: {
    setShape: (annotationId: string, key: string, value: object | null) => Promise<void>;
    setShapes: (annotationId: string, entries: Array<{ key: string; value: object | null }>) => Promise<void>;
  },
  annotationId: string,
  entries: Array<{ key: string; value: object | null }>,
): Promise<void> {
  if (entries.length === 0) return;
  if (entries.length === 1) {
    await annotations.setShape(annotationId, entries[0].key, entries[0].value);
  } else {
    await annotations.setShapes(annotationId, entries);
  }
}