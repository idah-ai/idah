import { Marked, type Tokens } from "marked";

// Help topics are Markdown with a few extra blocks the drawer turns into real UI:
//
// ```tree                      a file tree with icons; indent by 2 spaces per level.
// drive_01/                    "name/" is a folder, "dataset: name" a dataset, the rest
//   cam_a/0001.png             files; text after "  # " is a muted note on that line.
//   cover.png  # ignored
// ```
//
// ```example                   a "You pick → You get" card: sections split by a "---" line,
// You pick                     each starting with its caption (inline Markdown) followed
// drive_01/                    by tree lines.
// ---
// You get **1 dataset**
// dataset: drive_01
// ```
//
// > [!NOTE] / [!TIP] / [!WARNING]  as the first line of a quote makes it a callout box.

const ICONS = {
  // lucide icons, inlined: the topic is rendered to an HTML string
  folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  dataset:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
} as const;

const CALLOUTS: Record<string, string> = { NOTE: "Note", TIP: "Tip", WARNING: "Warning" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function icon(kind: keyof typeof ICONS): string {
  return `<svg class="help-tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind]}</svg>`;
}

interface TreeLine {
  depth: number;
  kind: keyof typeof ICONS;
  name: string;
  note?: string;
}

export function parseTree(text: string): TreeLine[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const depth = Math.floor((line.length - line.trimStart().length) / 2);
      const [content, note] = line.trim().split(/\s+#\s+/, 2);
      if (content.startsWith("dataset:")) return { depth, kind: "dataset", name: content.slice(8).trim(), note };
      return { depth, kind: content.endsWith("/") ? "folder" : "file", name: content, note };
    });
}

export function renderTree(text: string): string {
  const rows = parseTree(text).map(
    ({ depth, kind, name, note }) =>
      `<li class="help-tree-row" style="padding-left: ${depth * 1.25}rem">${icon(kind)}` +
      `<span class="help-tree-name">${escapeHtml(name)}</span>` +
      (note ? `<span class="help-tree-note">${escapeHtml(note)}</span>` : "") +
      "</li>",
  );
  return `<ul class="help-tree">${rows.join("")}</ul>`;
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }: Tokens.Code) {
      if (lang === "tree") return renderTree(text);
      if (lang === "example") return renderExample(text);
      return false; // a plain code block
    },
  },
});

function renderExample(text: string): string {
  const sections = text.split(/^---\s*$/m).map((section) => {
    const [caption, ...lines] = section.replace(/^\n+/, "").split("\n");
    return (
      `<div class="help-example-section"><div class="help-example-caption">${marked.parseInline(caption)}</div>` +
      `${renderTree(lines.join("\n"))}</div>`
    );
  });
  return `<div class="help-example">${sections.join('<div class="help-example-arrow" aria-hidden="true">↓</div>')}</div>`;
}

// The topic body as HTML. Topics are our own files, never user input.
export function renderHelp(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING)\]\s*/g,
    (_, kind: string) =>
      `<blockquote class="help-callout help-callout-${kind.toLowerCase()}"><p><strong>${CALLOUTS[kind]}.</strong> `,
  );
}
