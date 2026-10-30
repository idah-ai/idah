import { describe, it, expect } from "vitest";

import {
  buildExportItemName,
  classifyExport,
  exportSummaryLabel,
  getExportJobArguments,
  summarizeExportKinds,
} from "./utils";

import type { ExportRecord } from "@/data/model/sync/exports/record";

function makeExport(argumentsData: Record<string, unknown>): ExportRecord {
  return { job: { arguments: argumentsData } } as unknown as ExportRecord;
}

describe("getExportJobArguments", () => {
  it("returns job arguments or an empty object", () => {
    expect(getExportJobArguments(makeExport({ entry_ids: ["e1"] }))).toEqual({ entry_ids: ["e1"] });
    expect(getExportJobArguments({} as unknown as ExportRecord)).toEqual({});
  });
});

describe("classifyExport", () => {
  it("classifies entry exports by presence of entry_ids", () => {
    expect(classifyExport(makeExport({ dataset_ids: ["d1"], entry_ids: ["e1"] }))).toBe("entry");
  });

  it("classifies dataset exports when no entry_ids", () => {
    expect(classifyExport(makeExport({ dataset_ids: ["d1"] }))).toBe("dataset");
  });

  it("treats an empty entry_ids list as a dataset export", () => {
    expect(classifyExport(makeExport({ dataset_ids: ["d1"], entry_ids: [] }))).toBe("dataset");
  });
});

describe("summarizeExportKinds", () => {
  it("returns entry when all are entry exports", () => {
    expect(summarizeExportKinds([makeExport({ entry_ids: ["e1"] }), makeExport({ entry_ids: ["e2"] })])).toBe("entry");
  });

  it("returns dataset when all are dataset exports", () => {
    expect(summarizeExportKinds([makeExport({}), makeExport({})])).toBe("dataset");
  });

  it("returns mixed when both kinds are present", () => {
    expect(summarizeExportKinds([makeExport({ entry_ids: ["e1"] }), makeExport({})])).toBe("mixed");
  });
});

describe("exportSummaryLabel", () => {
  it("labels an entry export batch", () => {
    const records = [makeExport({ entry_ids: ["e1"] })];

    expect(exportSummaryLabel(records, "ready")).toBe("Entry export ready");
    expect(exportSummaryLabel(records, "error")).toBe("Entry export error");
    expect(exportSummaryLabel(records, "inProgress")).toBe("Entry export in progress...");
  });

  it("labels a dataset export batch", () => {
    expect(exportSummaryLabel([makeExport({})], "ready")).toBe("Dataset export ready");
  });

  it("labels a mixed batch generically", () => {
    expect(exportSummaryLabel([makeExport({ entry_ids: ["e1"] }), makeExport({})], "ready")).toBe("Exports ready");
  });

  it("handles an empty batch", () => {
    expect(exportSummaryLabel([], "ready")).toBe("Export ready");
  });
});

describe("buildExportItemName", () => {
  it("summarizes entry exports by count and dataset name", () => {
    expect(buildExportItemName(makeExport({ entry_ids: ["e1", "e2"] }), ["My Dataset"])).toBe("2 entries · My Dataset");
    expect(buildExportItemName(makeExport({ entry_ids: ["e1"] }), ["My Dataset"])).toBe("1 entry · My Dataset");
  });

  it("uses dataset names for dataset exports", () => {
    expect(buildExportItemName(makeExport({}), ["A", "B"])).toBe("A, B");
  });
});
