// ---------------------------------------------------------------------------
// help-markdown.test.ts — help topics' Markdown, with trees, examples and callouts
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { parseTree, renderHelp } from "./help-markdown";

describe("parseTree", () => {
  it("reads depth from 2-space indents, folders from a trailing slash, datasets and notes", () => {
    expect(parseTree("dataset: clips\n  cam_a/\n    0001.png\n  cover.png  # ignored")).toEqual([
      { depth: 0, kind: "dataset", name: "clips", note: undefined },
      { depth: 1, kind: "folder", name: "cam_a/", note: undefined },
      { depth: 2, kind: "file", name: "0001.png", note: undefined },
      { depth: 1, kind: "file", name: "cover.png", note: "ignored" },
    ]);
  });
});

describe("renderHelp", () => {
  it("renders a tree block as a list with icons, escaping names", () => {
    const html = renderHelp("```tree\nclip/\n  <a>.png\n```");

    expect(html).toContain('<ul class="help-tree">');
    expect(html).toContain('style="padding-left: 1.25rem"');
    expect(html).toContain("&#60;a&#62;.png");
    expect(html).not.toContain("<a>.png");
  });

  it("renders an example block as captioned trees joined by an arrow", () => {
    const html = renderHelp("```example\nYou pick\nclip/\n---\nYou get **1 dataset**\ndataset: clip\n```");

    expect(html.match(/help-example-section/g)).toHaveLength(2);
    expect(html).toContain("<strong>1 dataset</strong>");
    expect(html).toContain("help-example-arrow");
  });

  it("turns a [!NOTE] quote into a callout and leaves other quotes and code alone", () => {
    expect(renderHelp("> [!WARNING]\n> Careful.")).toContain(
      '<blockquote class="help-callout help-callout-warning"><p><strong>Warning.</strong> Careful.',
    );
    expect(renderHelp("> Just a quote.")).toContain("<blockquote>\n<p>Just a quote.");
    expect(renderHelp("```js\nconst a = 1;\n```")).toContain('<code class="language-js">');
  });
});
