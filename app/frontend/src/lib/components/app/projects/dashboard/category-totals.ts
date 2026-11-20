export interface CategoryTotal {
  id: string;
  category: string;
  label: string;
  configured: boolean;
  annotation_count: number;
}

export interface CategoryTotalsResult<T extends CategoryTotal> {
  status: "loading" | "ready" | "error";
  rows: T[];
  total: number | null;
  error: string;
}

export function categoryTotal(rows: CategoryTotal[]): number {
  let total = 0;
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      !row.id ||
      ids.has(row.id) ||
      typeof row.category !== "string" ||
      !row.category ||
      typeof row.label !== "string" ||
      !row.label ||
      typeof row.configured !== "boolean" ||
      !Number.isSafeInteger(row.annotation_count) ||
      row.annotation_count < 0
    )
      throw new Error("Category totals could not be validated. Please retry.");
    ids.add(row.id);
    total += row.annotation_count;
    if (!Number.isSafeInteger(total)) throw new Error("Category total exceeds the supported range.");
  }
  return total;
}

export function categoryShare(count: number, total: number): { value: number; label: string } {
  const value = total > 0 ? (count / total) * 100 : 0;
  return { value, label: value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%` };
}

export function sortCategories<T extends CategoryTotal>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.annotation_count - a.annotation_count || a.label.localeCompare(b.label) || a.category.localeCompare(b.category),
  );
}
