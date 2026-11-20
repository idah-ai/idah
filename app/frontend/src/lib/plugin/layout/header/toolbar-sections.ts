// ---------------------------------------------------------------------------
// toolbar-sections.ts — Where the header toolbar draws dividers
//
// Top-level buttons carry an optional `section` ("select", "draw", …). A divider
// goes between two visible buttons whose sections differ, so a section a project
// doesn't enable (e.g. no drawing tools) leaves no empty gap or double divider.
// ---------------------------------------------------------------------------

/** For each visible top-level button, in order: whether a divider goes before it. */
export function dividerBefore(sections: readonly (string | undefined)[]): boolean[] {
  return sections.map((section, i) => i > 0 && section !== sections[i - 1]);
}
