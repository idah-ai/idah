import HelpTopic from "./HelpTopic.svelte";
import { helpTopics } from "./help-topics";

import { closeSheet, getSheet, openSheet } from "@/components/app/overlays/sheets/sheet.service.svelte";

// Help is shown in the app's side panel (see sheet.service.svelte.ts): any component opens a
// topic with openHelp("dataset-upload"), or drops a <HelpLink topic="..." /> next to what needs
// explaining. The panel closes by itself once no HelpLink for its topic is left on the page.

const HELP = "help"; // the panel's sheet id

export const help = {
  get topic(): string | null {
    return (getSheet(HELP)?.props?.topic as string | undefined) ?? null;
  },
  get open(): boolean {
    return this.topic !== null;
  },
};

export function openHelp(topic: string): void {
  openSheet({
    id: HELP,
    kind: "panel",
    title: helpTopics[topic]?.title ?? "Help",
    component: HelpTopic,
    props: { topic },
  });
}

// Opens the topic, or closes the panel when that topic is already shown.
export function toggleHelp(topic: string): void {
  if (help.topic === topic) closeHelp();
  else openHelp(topic);
}

export function closeHelp(): void {
  closeSheet(HELP);
}

// How many HelpLinks for each topic are on the page. When the last one for the open topic
// goes away (its modal closed, the page changed), the help no longer applies: close it.
const linksOnPage: Record<string, number> = {}; // plain: nothing renders from it

// Called by HelpLink while it is mounted; returns the cleanup to call on unmount.
export function registerHelpLink(topic: string): () => void {
  linksOnPage[topic] = (linksOnPage[topic] ?? 0) + 1;
  return () => {
    linksOnPage[topic] = (linksOnPage[topic] ?? 1) - 1;
    // Checked after the current update: a link that is only re-rendered remounts right away.
    setTimeout(() => {
      if (help.topic === topic && !linksOnPage[topic]) closeHelp();
    });
  };
}
