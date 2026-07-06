import { getContext, setContext } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

import { getTextColor, randomHex } from "@/components/app/color-picker/utils";
import { showToast } from "@/components/ui/toast/index.svelte";
import { labelColors } from "@/data/model/dataset/labels";
import { humanize, slugify } from "@/utils/string";

import type { IConfig, IConfigProperty, IConfigValue } from "@/plugin/v2/types";

/**
 * Owns all label-config edit state and mutations, so the same editor can be
 * reused by the dataset labels page and the template management modal — each
 * host wires its own load/save target.  Extracted from the dataset labels
 * `+page.svelte`; the mutation logic is a straight port.
 */
export class LabelConfigController {
  labelConfig = $state<IConfig>({});
  savedSnapshot = $state("");

  /** Per-instance replacement for the former module-global categoryOrderMap.
   *  Plain object (not $state): mutated in place during tree construction,
   *  exactly as the previous global was. */
  categoryOrderMap: Record<string, number> = {};

  hasUnsavedChanges = $derived(JSON.stringify(this.labelConfig) !== this.savedSnapshot);

  // ---------------------------------------------------------------- lifecycle
  load(config: IConfig | undefined) {
    this.clearOrderMap();
    this.labelConfig = config ?? {};
    this.savedSnapshot = JSON.stringify(this.labelConfig);
  }

  markSaved(config: IConfig | undefined) {
    this.labelConfig = config ?? {};
    this.savedSnapshot = JSON.stringify(this.labelConfig);
  }

  /** Marks the current live config as saved without pruning or replacing it.
   *  Used after saving/replacing a template, where we want to clear the dirty
   *  flag but keep the editor (including in-progress empty shapes) intact. */
  markCurrentAsSaved() {
    this.savedSnapshot = JSON.stringify(this.labelConfig);
  }

  /** Replace the config WITHOUT resetting the snapshot, so it registers as an
   *  unsaved change (used by "Apply template"). */
  apply(config: IConfig | undefined) {
    this.clearOrderMap();
    this.labelConfig = JSON.parse(JSON.stringify(config ?? {}));
  }

  private clearOrderMap() {
    for (const key of Object.keys(this.categoryOrderMap)) {
      delete this.categoryOrderMap[key];
    }
  }

  /** Cleaned + tree-sorted config, ready to persist. */
  getCleanedConfig(): IConfig {
    const cleaned: IConfig = {};
    Object.entries(this.labelConfig).forEach(([key, config]) => {
      if (config.values.length > 0 || config.properties.length > 0) {
        cleaned[key] = { ...config, values: this.sortValuesByTreeOrder(config.values) };
      }
    });
    return cleaned;
  }

  // ------------------------------------------------- order helpers (ex-utils)
  getCategoryOrder(path: string): number | undefined {
    return this.categoryOrderMap[path];
  }

  getSiblingOrders(parentPrefix: string): Array<{ path: string; order: number }> {
    const result: Array<{ path: string; order: number }> = [];
    const prefix = parentPrefix ? parentPrefix + "/" : "";
    for (const [key, order] of Object.entries(this.categoryOrderMap)) {
      if (key === parentPrefix) continue;
      const isSibling = parentPrefix
        ? key.startsWith(prefix) && !key.slice(prefix.length).includes("/")
        : !key.includes("/");
      if (isSibling) result.push({ path: key, order });
    }
    return result.sort((a, b) => a.order - b.order);
  }

  sortValuesByTreeOrder(values: IConfigValue[]): IConfigValue[] {
    return [...values].sort((a, b) => {
      const aOrder = this.getCategoryOrder(a.id) ?? Infinity;
      const bOrder = this.getCategoryOrder(b.id) ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });
  }

  private compareByTreeOrder(aId: string, bId: string): number {
    const aParts = aId.split("/");
    const bParts = bId.split("/");
    let prefix = "";
    const len = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const aPath = prefix ? `${prefix}/${aParts[i]}` : aParts[i];
      const bPath = prefix ? `${prefix}/${bParts[i]}` : bParts[i];
      if (aPath !== bPath) {
        const ao = this.getCategoryOrder(aPath) ?? Infinity;
        const bo = this.getCategoryOrder(bPath) ?? Infinity;
        if (ao !== bo) return ao - bo;
        return aPath.localeCompare(bPath);
      }
      prefix = aPath;
    }
    return aParts.length - bParts.length;
  }

  // --------------------------------------------------- shape/config mutations
  private nextShapeOrder(): number {
    const orders = Object.values(this.labelConfig).map((c) => c.order ?? -1);
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  addLabelConfig(labelConfigKey: string) {
    if (!this.labelConfig[labelConfigKey]) {
      this.labelConfig[labelConfigKey] = { values: [], properties: [], order: this.nextShapeOrder() };
    }
  }

  duplicateConfig(sourceLabelConfigKey: string, targetLabelConfigKey: string) {
    if (this.labelConfig[targetLabelConfigKey]) {
      showToast.error({
        title: "Configuration already exists",
        description: `A configuration named "${targetLabelConfigKey}" already exists.`,
      });
      return;
    }
    this.labelConfig[targetLabelConfigKey] = {
      ...JSON.parse(JSON.stringify(this.labelConfig[sourceLabelConfigKey])),
      order: this.nextShapeOrder(),
    };
  }

  reorderShape(draggedKey: string, targetKey: string, position: "before" | "after") {
    if (draggedKey === targetKey) return;

    // Current display order of shape keys (sorted by `order`, legacy fallback to
    // existing key order).
    const keys = Object.keys(this.labelConfig)
      .map((key, index) => ({ key, index, order: this.labelConfig[key]?.order ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
      .map((e) => e.key);

    const from = keys.indexOf(draggedKey);
    if (from === -1) return;
    keys.splice(from, 1);

    const target = keys.indexOf(targetKey);
    if (target === -1) return;
    keys.splice(position === "before" ? target : target + 1, 0, draggedKey);

    // Reassign sequential order numbers; mutating each config marks the change
    // (enables Save) and re-derives the sorted list in the editor.
    keys.forEach((key, i) => {
      this.labelConfig[key].order = i;
    });
  }

  removeLabelConfig(key: string) {
    this.labelConfig = Object.fromEntries(Object.entries(this.labelConfig).filter(([k]) => k !== key));
  }

  // -------------------------------------------------------- category mutations
  private getColor(labelConfigKey: string) {
    const selected = this.labelConfig[labelConfigKey];
    const usedColors = selected.values.map((cat) => cat.color);
    const remaining = labelColors.filter((color) => !usedColors.includes(color.color));
    const pick = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : undefined;
    if (!pick) {
      let randomColor = randomHex();
      while (usedColors.includes(randomColor)) randomColor = randomHex();
      return { color: randomColor, text_color: getTextColor(randomColor) };
    }
    return { color: pick.color, text_color: pick.text_color };
  }

  addCategory(labelConfigKey: string, nodeId?: string) {
    const currentTime = Date.now().toString();
    const newLabel = "New Category";
    const newId = slugify(currentTime);
    const selected = this.labelConfig[labelConfigKey];
    const { color, text_color } = this.getColor(labelConfigKey);
    const categoryExists = (id: string) => selected.values.some((cat) => cat.id === id);

    /** Add a new root category */
    if (!nodeId) {
      if (categoryExists(newId)) return;
      selected.values.push({ id: newId, label: newLabel, color, text_color });
      return;
    }

    const childId = `${nodeId}/${currentTime}`;

    /** Prevent duplicate exact IDs */
    if (categoryExists(childId)) return;

    const parentCategories = selected.values.filter((cat) => cat.id === nodeId || cat.id.startsWith(`${nodeId}/`));

    /** Add a new sub-category, if parent category not exists */
    if (!parentCategories.length) {
      selected.values.push({ id: childId, label: newLabel, color, text_color });
      return;
    }

    /** Add a new sub-category, if parent category exists */
    if (parentCategories.length === 1) {
      const parentIndex = selected.values.findIndex((cat) => cat.id === nodeId);
      if (parentIndex !== -1) {
        selected.values[parentIndex] = { ...selected.values[parentIndex], id: childId, label: newLabel };
      } else {
        selected.values.push({ id: childId, label: newLabel, color, text_color });
      }
      return;
    }

    /** Add a new sub-category, if multiple parent categories exist */
    selected.values.push({ id: childId, label: newLabel, color, text_color });
  }

  editCategory(labelConfigKey: string, category: IConfigValue) {
    const selected = this.labelConfig[labelConfigKey];
    const idx = selected.values.findIndex((cat) => cat.id === category.id);

    // Editing an existing selectable category
    if (idx >= 0) {
      const existing = selected.values[idx];
      const newId = existing.id.split("/").slice(0, -1).concat(slugify(category.label)).join("/");
      if (selected.values.some((cat) => cat.id === newId && cat.id !== existing.id)) {
        this.showDuplicateCategoryError(newId);
        return;
      }
      selected.values[idx] = { ...existing, ...category, label: category.label, id: newId };
      return;
    }

    // Editing an intermediate category (update descendants)
    const hasChildren = selected.values.some((cat) => cat.id.startsWith(category.id + "/"));
    if (hasChildren) {
      const slugifiedLabel = slugify(category.label);
      const parentPrefix = category.id.split("/").slice(0, -1).join("/");
      const childUpdates = selected.values
        .filter((cat) => cat.id.startsWith(category.id + "/"))
        .map((cat) => ({
          oldId: cat.id,
          newId: `${parentPrefix ? `${parentPrefix}/` : ""}${slugifiedLabel}${cat.id.slice(category.id.length)}`,
        }));

      const existingIds = new SvelteSet(selected.values.map((cat) => cat.id));
      childUpdates.forEach((u) => existingIds.delete(u.oldId));
      const collision = childUpdates.find((u) => existingIds.has(u.newId));
      if (collision) {
        this.showDuplicateCategoryError(collision.newId);
        return;
      }

      selected.values = this.applyCategoryIdUpdates(selected.values, childUpdates);
      return;
    }

    selected.values.push(category);
  }

  editCategoryId(labelConfigKey: string, oldId: string, newId: string) {
    const selected = this.labelConfig[labelConfigKey];

    if (selected.values.some((cat) => cat.id === newId && cat.id !== oldId)) {
      this.showDuplicateCategoryError(newId);
      return;
    }

    const childUpdates = selected.values
      .filter((cat) => cat.id.startsWith(oldId + "/"))
      .map((cat) => ({ oldId: cat.id, newId: newId + cat.id.slice(oldId.length) }));

    const existingIds = new SvelteSet(selected.values.map((cat) => cat.id));
    existingIds.delete(oldId);
    childUpdates.forEach((u) => existingIds.delete(u.oldId));
    const collision = childUpdates.find((u) => existingIds.has(u.newId));
    if (collision) {
      this.showDuplicateCategoryError(collision.newId);
      return;
    }

    const idx = selected.values.findIndex((cat) => cat.id === oldId);
    if (idx >= 0) {
      selected.values[idx] = {
        ...selected.values[idx],
        id: newId,
        label: humanize(newId.split("/").at(-1) || "") || "",
      };
    }

    if (childUpdates.length > 0) {
      selected.values = this.applyCategoryIdUpdates(selected.values, childUpdates);
    }
  }

  changeSelectableCategory(labelConfigKey: string, editedCategory: IConfigValue, selectable: boolean) {
    const selected = this.labelConfig[labelConfigKey];
    const { color, text_color } = this.getColor(labelConfigKey);

    if (selectable) {
      if (selected.values.some((v) => v.id === editedCategory.id)) return;

      const newEntry: IConfigValue = { id: editedCategory.id, label: editedCategory.label, color, text_color };

      // Insert at the correct tree position based on category order map,
      // rather than always pushing to the end.
      const parentPrefix = editedCategory.id.includes("/") ? editedCategory.id.split("/").slice(0, -1).join("/") : "";
      const siblings = this.getSiblingOrders(parentPrefix);
      const targetOrder = this.getCategoryOrder(editedCategory.id);

      if (targetOrder !== undefined && siblings.length > 0) {
        let insertIndex = selected.values.length;
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].order > targetOrder) {
            const siblingIndex = selected.values.findIndex((v) => v.id === siblings[i].path);
            if (siblingIndex !== -1) {
              insertIndex = siblingIndex;
              break;
            }
          }
        }
        selected.values.splice(insertIndex, 0, newEntry);
      } else {
        selected.values.push(newEntry);
      }
    } else {
      selected.values = selected.values.filter((cat) => cat.id !== editedCategory.id);
    }
  }

  reorderCategory(labelConfigKey: string, draggedId: string, targetId: string, position: "before" | "after") {
    const selected = this.labelConfig[labelConfigKey];
    if (!selected || draggedId === targetId) return;

    const inSubtree = (id: string, rootId: string) => id === rootId || id.startsWith(rootId + "/");

    // Never drop a node into its own subtree.
    if (inSubtree(targetId, draggedId)) return;

    // Work in display order so each subtree is a contiguous block.
    const ordered = [...selected.values].sort((a, b) => this.compareByTreeOrder(a.id, b.id));

    const draggedBlock = ordered.filter((v) => inSubtree(v.id, draggedId));
    if (draggedBlock.length === 0) return;
    const remaining = ordered.filter((v) => !inSubtree(v.id, draggedId));

    // Target's contiguous block within `remaining`.
    const targetStart = remaining.findIndex((v) => inSubtree(v.id, targetId));
    if (targetStart === -1) return;
    let targetEnd = targetStart;
    while (targetEnd + 1 < remaining.length && inSubtree(remaining[targetEnd + 1].id, targetId)) {
      targetEnd++;
    }

    const insertIndex = position === "before" ? targetStart : targetEnd + 1;
    const reordered = [...remaining.slice(0, insertIndex), ...draggedBlock, ...remaining.slice(insertIndex)];

    // Renumber leaf orders from the new DFS order; drop intermediate entries so
    // the tree recomputes their position from their (renumbered) children.
    const valueIds = new SvelteSet(reordered.map((v) => v.id));
    reordered.forEach((v, index) => {
      this.categoryOrderMap[v.id] = index;
    });
    for (const v of reordered) {
      const parts = v.id.split("/");
      let path = "";
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        if (!valueIds.has(path)) delete this.categoryOrderMap[path];
      }
    }

    selected.values = reordered;
  }

  removeCategory(labelConfigKey: string, categoryId: string) {
    const selected = this.labelConfig[labelConfigKey];
    if (!selected) return;

    const normalizedId = categoryId.trim();
    const hasChildren = selected.values.some((v) => v.id.trim().startsWith(normalizedId + "/"));

    selected.values = selected.values.filter((value) => {
      const valueId = value.id.trim();
      // remove self
      if (valueId === normalizedId) return false;
      // remove children (only when deleting parent)
      if (hasChildren && valueId.startsWith(normalizedId + "/")) return false;
      return true;
    });
  }

  // -------------------------------------------------------- property mutations
  setProperty(labelConfigKey: string, property: IConfigProperty) {
    const selected = this.labelConfig[labelConfigKey];
    const idx = selected.properties.findIndex((p) => p.id === property.id);
    if (idx >= 0) {
      /** Update existing property */
      const propertyToCreate = property;
      /** If user update the label, update the property.id with slugified label */
      if (propertyToCreate.label !== "New Property") {
        propertyToCreate.id = slugify(propertyToCreate.label);
      }
      selected.properties[idx] = { ...propertyToCreate };
    } else {
      /** Add new property */
      selected.properties.push(property);
    }
  }

  removeProperty(labelConfigKey: string, propertyId: string) {
    const selected = this.labelConfig[labelConfigKey];
    selected.properties = selected.properties.filter((p) => p.id !== propertyId);
  }

  // ------------------------------------------------------------- private utils
  private showDuplicateCategoryError(id: string) {
    showToast.error({ title: "Duplicate category", description: `Category "${id}" already exists.` });
  }

  private applyCategoryIdUpdates(values: IConfigValue[], childUpdates: { oldId: string; newId: string }[]) {
    const updateMap = new SvelteMap(childUpdates.map((u) => [u.oldId, u.newId]));
    return values.map((cat) => {
      const newId = updateMap.get(cat.id);
      return newId ? { ...cat, id: newId } : cat;
    });
  }
}

// -------------------------------------------------------------------- context
const LABEL_CONFIG_CONTROLLER_KEY = Symbol("label-config-controller");

export function setLabelConfigController(controller: LabelConfigController) {
  setContext(LABEL_CONFIG_CONTROLLER_KEY, controller);
}

export function getLabelConfigController(): LabelConfigController {
  return getContext(LABEL_CONFIG_CONTROLLER_KEY);
}
