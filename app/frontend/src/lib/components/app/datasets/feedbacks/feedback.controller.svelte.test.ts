import { describe, expect, it } from "vitest";

import { FeedBackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";

describe("FeedBackConfigController feedback payload", () => {
  it("sends a string description when a new item's optional description is untouched", () => {
    const controller = new FeedBackConfigController({});
    controller.openFormModal();
    controller.formModalData.label = "Fix this";
    controller.upsertItem();

    expect(Object.values(controller.getConfigHash())).toEqual([{ label: "Fix this", description: "" }]);
  });

  it("normalizes existing items with a null description when saving a template", () => {
    const controller = new FeedBackConfigController({ existing: { label: "Fix this", description: null } });

    expect(controller.getConfigHash()).toEqual({ existing: { label: "Fix this", description: "" } });
  });
});
