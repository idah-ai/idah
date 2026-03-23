export interface SidebarType {
  label: string;
  href?: string;
  children: SidebarType[];
  visible?: boolean;
  selectable?: boolean;
}

export const desktopSidebarItems: SidebarType[] = [
  {
    label: "Welcome",
    href: "/",
    children: [],
    visible: false,
  },
  {
    label: "Getting Started",
    children: [
      { label: "What is IDAH?", href: "/getting-started/about", children: [] },
      { label: "Key features", href: "/getting-started/key-features", children: [] },
      { label: "Use cases", href: "/getting-started/use-cases", children: [] },
    ],
  },
  {
    label: "Installation Guide",
    children: [
      { label: "Installation", href: "/install", children: [] },
      { label: "Set up Databases", href: "/install/databases", children: [] },
      { label: "Set up Persistent Storage", href: "/install/storage", children: [] },
      { label: "Start IDAH", href: "/install/start", children: [] },
    ],
  },
  {
    label: "Plugin Development",
    children: [
      { label: "Create a plugin", href: "/plugin/create-plugin", children: [] },
      { label: "Frontend guide", href: "/plugin/frontend-guide", children: [] },
      { label: "Backend guide", href: "/plugin/backend-guide", children: [] },
      { label: "Import and process media", href: "/plugin/import-media", children: [] },
      { label: "Export datasets", href: "/plugin/export-datasets", children: [] },
    ],
  },
];

export const mobileSidebarItems: SidebarType[] = [
  { label: "Changing log", href: "/changelog", children: [] },
  { label: "Support", href: "/support", children: [] },
  { label: "Install IDAH", href: "/install", children: [] },
  ...desktopSidebarItems,
];
