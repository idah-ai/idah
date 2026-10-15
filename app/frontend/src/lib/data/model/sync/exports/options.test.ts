import { describe, expect, it } from "vitest";

import {
  defaultExportOptionValues,
  exportOptionChoices,
  exportOptionKind,
  exportOptionLabel,
  exportOptionPayload,
} from "./options";

import type { ExportOptionField } from "./type";

const task: ExportOptionField = {
  name: "task",
  type: "string",
  default: "detect",
  required: false,
  label: "Task",
  choices: [
    { value: "detect", label: "Detection (boxes)", info: "One upright box per object." },
    { value: "segment", label: "Segmentation (outlines)" },
    { value: "obb", label: "obb" },
  ],
};
const valPercent: ExportOptionField = { name: "val_percent", type: "integer", default: 0, required: false, min: 0, max: 50 };
const keyframesOnly: ExportOptionField = { name: "keyframes_only", type: "boolean", default: false, required: false };
const note: ExportOptionField = { name: "note", type: "string", required: false };

describe("exportOptionKind", () => {
  it("shows an option with choices as a select", () => {
    expect(exportOptionKind(task)).toBe("select");
  });

  it("shows a boolean as a switch, a number as a number field and the rest as text", () => {
    expect(exportOptionKind(keyframesOnly)).toBe("switch");
    expect(exportOptionKind(valPercent)).toBe("number");
    expect(exportOptionKind({ ...valPercent, type: "number" })).toBe("number");
    expect(exportOptionKind(note)).toBe("text");
  });
});

describe("exportOptionLabel", () => {
  it("uses the label, or the name made readable", () => {
    expect(exportOptionLabel(task)).toBe("Task");
    expect(exportOptionLabel(valPercent)).toBe("Val percent");
  });
});

describe("exportOptionChoices", () => {
  it("turns the choices into select choices, their info shown as description", () => {
    expect(exportOptionChoices(task)).toEqual([
      { label: "Detection (boxes)", description: "One upright box per object.", value: "detect" },
      { label: "Segmentation (outlines)", description: undefined, value: "segment" },
      { label: "obb", description: undefined, value: "obb" },
    ]);
    expect(exportOptionChoices(note)).toEqual([]);
  });

  it("leaves the description empty for a choice without info", () => {
    const choices = exportOptionChoices({ ...task, choices: [{ value: "obb", label: "Oriented boxes" }] });

    expect(choices).toEqual([{ label: "Oriented boxes", description: undefined, value: "obb" }]);
  });
});

describe("defaultExportOptionValues", () => {
  it("starts each option at its default, or empty", () => {
    expect(defaultExportOptionValues([task, valPercent, keyframesOnly, note])).toEqual({
      task: "detect",
      val_percent: 0,
      keyframes_only: false,
      note: null,
    });
  });

  it("has no values for a format without options", () => {
    expect(defaultExportOptionValues(undefined)).toEqual({});
  });
});

describe("exportOptionPayload", () => {
  it("sends the values of the format's options", () => {
    expect(
      exportOptionPayload([task, valPercent, keyframesOnly], { task: "segment", val_percent: 20, keyframes_only: true }),
    ).toEqual({ task: "segment", val_percent: 20, keyframes_only: true });
  });

  it("leaves out empty values, so the server applies the default", () => {
    expect(exportOptionPayload([valPercent, note], { val_percent: null, note: "" })).toEqual({});
  });

  it("sends numbers typed as text as numbers", () => {
    expect(exportOptionPayload([valPercent], { val_percent: "20" })).toEqual({ val_percent: 20 });
  });

  it("leaves out values of options the format does not declare", () => {
    expect(exportOptionPayload([task], { task: "obb", leftover: "x" })).toEqual({ task: "obb" });
  });
});
