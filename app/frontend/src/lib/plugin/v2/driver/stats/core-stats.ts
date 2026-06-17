// ---------------------------------------------------------------------------
// Core entry stats — generic across all modalities.
//
// Mirrors the backend EntryStats::CoreStats: annotation / category / shape
// counts computed live from the driver's annotations and label config. Plugin-
// specific stats (e.g. video info) are contributed separately via
// driver.stats.register().
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, IStatEntry } from "../../types";

// Section presentation metadata for the core stat groups.
const ANNOTATION_SECTION = { section: "annotation", sectionHeader: "Object", unitHeader: "Count" } as const;
const CATEGORY_SECTION = { section: "category", unitHeader: "Count" } as const;
const SHAPE_SECTION = { section: "shape", unitHeader: "Count" } as const;

export async function computeCoreStats(driver: IIdahDriverV2): Promise<IStatEntry[]> {
  const annotations = await driver.annotations.fetch();
  const rawConfig = driver.config as Record<string, unknown>;

  // Category field can be overridden at the top level of labeling_configuration
  const categoryField = typeof rawConfig.category_field === "string" ? rawConfig.category_field : "category";

  // Zero-fill all configured category ids
  const categoryCounts = new Map<string, number>();
  for (const shapeConfig of Object.values(rawConfig)) {
    if (typeof shapeConfig !== "object" || !shapeConfig || !("values" in shapeConfig)) continue;
    const values = (shapeConfig as { values?: { id?: string }[] }).values ?? [];
    for (const v of values) {
      if (typeof v.id === "string") categoryCounts.set(v.id, 0);
    }
  }

  // Zero-fill shape types from config keys — keys containing ":" are modality:tool-type entries
  const shapeCounts = new Map<string, number>();
  for (const key of Object.keys(rawConfig)) {
    if (key.includes(":")) shapeCounts.set(key.slice(key.indexOf(":") + 1), 0);
  }

  // Deduplicate by group — pick root annotation (no parent_id) as representative
  const representativeByGroup = new Map<string, (typeof annotations)[number]>();
  for (const ann of annotations) {
    const meta = ann.metadata;
    const groupKey = meta?.group_id ?? ann.id;
    if (!representativeByGroup.has(groupKey) || !meta?.parent_id) {
      representativeByGroup.set(groupKey, ann);
    }
  }

  for (const ann of representativeByGroup.values()) {
    // Category — read from annotation.value[categoryField]
    const category = (ann.value as Record<string, unknown> | undefined)?.[categoryField];
    if (typeof category === "string") {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    // Shape type — strip "<modality>:" prefix (mirrors backend CoreStats)
    const rawType = (ann.shape as Record<string, unknown> | undefined)?.type;
    if (typeof rawType === "string") {
      const colonIdx = rawType.indexOf(":");
      const shapeKey = colonIdx >= 0 ? rawType.slice(colonIdx + 1) : rawType;
      shapeCounts.set(shapeKey, (shapeCounts.get(shapeKey) ?? 0) + 1);
    }
  }

  const stats: IStatEntry[] = [
    { ...ANNOTATION_SECTION, key: "annotation.count", value: String(representativeByGroup.size), label: "Total" },
  ];

  for (const [id, count] of categoryCounts) {
    stats.push({ ...CATEGORY_SECTION, key: `category.${id}.count`, value: String(count) });
  }

  for (const [shape, count] of shapeCounts) {
    stats.push({ ...SHAPE_SECTION, key: `shape.${shape}.count`, value: String(count) });
  }

  return stats;
}
