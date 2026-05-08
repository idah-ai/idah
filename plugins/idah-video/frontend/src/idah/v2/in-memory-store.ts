// ---------------------------------------------------------------------------
// In-memory annotation store with filter support
// ---------------------------------------------------------------------------
import type { IFilter, IFilterValue, IRangeOp } from "$idah/v2/types";
import { uuidv7 } from "uuidv7";

// ---------------------------------------------------------------------------
// Helper: evaluate a single filter value against a record field value
// ---------------------------------------------------------------------------
function matchesFilter(fieldValue: unknown, filterValue: IFilterValue): boolean {
  // Simple equality (string / number)
  if (typeof filterValue === "string" || typeof filterValue === "number") {
    return fieldValue === filterValue;
  }

  // Range / comparison operators
  if (typeof filterValue === "object" && !Array.isArray(filterValue)) {
    const op = filterValue as IRangeOp;

    if (op.eq !== undefined) return fieldValue === op.eq;
    if (op.neq !== undefined) return fieldValue !== op.neq;

    // Number comparisons
    const num = Number(fieldValue);
    if (isNaN(num)) return false;

    if (op.gte !== undefined && num < Number(op.gte)) return false;
    if (op.gt !== undefined && num <= Number(op.gt)) return false;
    if (op.lte !== undefined && num > Number(op.lte)) return false;
    if (op.lt !== undefined && num >= Number(op.lt)) return false;

    return true; // no failing operator found
  }

  // Array-based operators
  if (Array.isArray(filterValue)) {
    return fieldValue !== undefined && (filterValue as unknown[]).includes(fieldValue);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Generic in-memory store
// ---------------------------------------------------------------------------
export class InMemoryStore<T extends { id: string }> {
  private records: T[] = [];
  private virtualFields: Map<string, (rec: T) => unknown> = new Map();

  seed(data: T[]): void {
    this.records = [...data];
  }

  /** Replace all records (handy for reset). */
  reset(data: T[]): void {
    this.records = [...data];
  }

  registerField(name: string, fn: (rec: T) => unknown): void {
    this.virtualFields.set(name, fn);
  }

  /** Resolve a dotted path like "frame.start" against a record. */
  private resolvePath(rec: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let value: unknown = rec;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }

  /** Return a deep-ish copy of all records matching the filter. */
  fetch(filter?: IFilter): T[] {
    let result = this.records;

    if (filter && Object.keys(filter).length > 0) {
      result = result.filter((rec) => {
        const record = rec as Record<string, unknown>;
        for (const [field, filterValue] of Object.entries(filter)) {
          // Resolve value — dotted paths then virtual fields
          let fieldValue: unknown = this.resolvePath(record, field);
          if (fieldValue === undefined && this.virtualFields.has(field)) {
            fieldValue = this.virtualFields.get(field)!(rec);
          }
          if (!matchesFilter(fieldValue, filterValue)) return false;
        }
        return true;
      });
    }

    // Return shallow copies
    return result.map((r) => ({ ...r }));
  }

  find(id: string): T | undefined {
    return this.records.find((r) => r.id === id);
  }

  update(id: string, data: Partial<T>): void {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Annotation not found: ${id}`);
    this.records[idx] = { ...this.records[idx], ...data };
  }

  delete(id: string): void {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Annotation not found: ${id}`);
    this.records.splice(idx, 1);
  }

  create(data: T): T {
    const id = uuidv7();
    const record = { ...data, id } as T;
    this.records.push(record);
    return { ...record };
  }

  all(): T[] {
    return [...this.records];
  }
}
