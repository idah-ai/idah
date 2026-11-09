// The help drawer's state, shared app-wide: which topic is shown, if any. Any component
// opens a topic with openHelp("dataset-upload"); HelpDrawer (mounted once in the root
// layout) shows it on the right of the screen, beside the page and any open modal. It
// closes by itself once no HelpLink for its topic is left on the page.

const state = $state<{ topic: string | null }>({ topic: null });

export const help = {
  get topic(): string | null {
    return state.topic;
  },
  get open(): boolean {
    return state.topic !== null;
  },
};

export function openHelp(topic: string): void {
  state.topic = topic;
}

// Opens the topic, or closes the drawer when that topic is already shown.
export function toggleHelp(topic: string): void {
  state.topic = state.topic === topic ? null : topic;
}

export function closeHelp(): void {
  state.topic = null;
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
      if (state.topic === topic && !linksOnPage[topic]) closeHelp();
    });
  };
}
