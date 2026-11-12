// Help topics are Markdown files in ./topics, one per topic, named by their id
// ("dataset-upload.md" is topic "dataset-upload"). The first "# " heading is the topic's
// title, shown in the drawer's header; the rest is its body. Editing help text never
// touches a component.

export interface HelpTopic {
  id: string;
  title: string;
  body: string; // Markdown
}

export function parseTopic(id: string, markdown: string): HelpTopic {
  const match = /^#\s+(.+)\s*$/m.exec(markdown);
  if (!match) return { id, title: id, body: markdown.trim() };

  const body = markdown.slice(0, match.index) + markdown.slice(match.index + match[0].length);
  return { id, title: match[1].trim(), body: body.trim() };
}

const files = import.meta.glob<string>("./topics/*.md", { query: "?raw", import: "default", eager: true });

export const helpTopics: Record<string, HelpTopic> = Object.fromEntries(
  Object.entries(files).map(([path, markdown]) => {
    const id = path.replace(/^.*\//, "").replace(/\.md$/, "");
    return [id, parseTopic(id, markdown)];
  }),
);
