// ---------------------------------------------------------------------------
// styles.ts — Resolve shape display styles from annotation property options
//
// For properties of type `single-select`, if the selected option has a
// `styles` field, those generic style keys (e.g. `border`, `opacity`) are
// translated to SVG/CSS-compatible values and returned as a flat record.
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";
import type { IConfigPropertyOption } from "$idah/v2/types";

/**
 * Mapping from generic border style values to SVG stroke-dasharray strings.
 * `undefined` means "do not set" (default solid rendering).
 */
const BORDER_DASHARRAY: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "6, 3",
  dotted: "2, 2",
};

/**
 * Mapping from generic style keys used in option.styles to the
 * SVG/CSS property actually set on the <path> element.
 */
const STYLE_SVG_MAP: Record<string, string> = {
  border: "stroke-dasharray",
  opacity: "opacity",
};

/**
 * Resolve the shape display styles for an annotation.
 *
 * Looks at all `single-select` properties defined in the shape config.
 * For each property where the annotation has a selected value, it finds
 * the matching option and collects its `styles`. All collected styles
 * are merged and translated to SVG/CSS properties.
 *
 * @param annotation  The annotation record (must have `shape.type` and
 *                    `value.attributes`).
 * @returns           A record of CSS/SVG property → value pairs.
 *
 * @example
 *   // annotation has attributes: { "shape-proprety": "option_2" }
 *   // option_2.styles = { border: "dashed", opacity: 4 }
 *   // Returns: { "stroke-dasharray": "6, 3", "opacity": "4" }
 */
export function resolveShapeStyles(
  annotation: {
    value?: { attributes?: Record<string, unknown> };
    shape?: { type?: string };
  },
): Record<string, string> {
  const config = getDriver().config[annotation?.shape?.type ?? ""];
  if (!config?.properties) return {};

  const attributes = annotation.value?.attributes ?? {};
  const mergedStyles: Record<string, unknown> = {};

  for (const prop of config.properties) {
    if (prop.type === "single-select" && prop.format?.options) {
      const selectedValue = attributes[prop.id];
      if (selectedValue !== undefined && selectedValue !== null) {
        const option: IConfigPropertyOption | undefined = prop.format.options.find(
          (o: IConfigPropertyOption) => o.id === selectedValue,
        );
        if (option?.styles) {
          for (const [key, value] of Object.entries(option.styles)) {
            if (value !== undefined && value !== null) {
              mergedStyles[key] = value;
            }
          }
        }
      }
    }
  }

  // Translate generic styles → SVG/CSS properties
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(mergedStyles)) {
    const svgKey = STYLE_SVG_MAP[key] ?? key;
    if (key === "border") {
      const dashValue = BORDER_DASHARRAY[String(value)];
      if (dashValue !== undefined) {
        result[svgKey] = dashValue;
      }
      // "solid" → no dasharray set (default)
    } else {
      result[svgKey] = String(value);
    }
  }

  return result;
}

/**
 * Convenience getter for a specific style property, or undefined if not set.
 */
export function getShapeStyle(
  styles: Record<string, string>,
  property: string,
): string | undefined {
  return styles[property] ?? undefined;
}