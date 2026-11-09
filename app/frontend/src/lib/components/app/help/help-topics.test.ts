// ---------------------------------------------------------------------------
// help-topics.test.ts — help topics read from Markdown files
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { helpTopics, parseTopic } from "./help-topics";

describe("parseTopic", () => {
  it("takes the first heading as the title and the rest as the body", () => {
    expect(parseTopic("x", "# Uploading\n\nPick files.\n\n## More\n\nText.")).toEqual({
      id: "x",
      title: "Uploading",
      body: "Pick files.\n\n## More\n\nText.",
    });
  });

  it("falls back to the id when there is no title", () => {
    expect(parseTopic("x", "Just text.")).toEqual({ id: "x", title: "x", body: "Just text." });
  });
});

describe("helpTopics", () => {
  it("loads every topic file by its name", () => {
    expect(helpTopics["dataset-upload"]?.title).toBe("Creating datasets from an upload");
  });
});
