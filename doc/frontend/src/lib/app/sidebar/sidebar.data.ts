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
      { label: "Key Features", href: "/getting-started/key-features", children: [] },
      { label: "Use Cases", href: "/getting-started/use-cases", children: [] },
    ],
  },
  {
    label: "Installation",
    children: [
      { label: "Installation", href: "/install", children: [] },
      { label: "Database Setup", href: "/install/databases", children: [] },
      { label: "Persistent Storage", href: "/install/storage", children: [] },
      { label: "Start IDAH", href: "/install/start", children: [] },
    ],
  },
  {
    label: "Plugin Development",
    children: [
      { label: "Plugin Overview", href: "/plugin", children: [] },
      { label: "Create a Plugin", href: "/plugin/create-plugin", children: [] },
      { label: "Frontend Guide", href: "/plugin/frontend-guide", children: [] },
      { label: "Backend Guide", href: "/plugin/backend-guide", children: [] },
      { label: "Import & Process Media", href: "/plugin/import-media", children: [] },
      { label: "Export Datasets", href: "/plugin/export-datasets", children: [] },
    ],
  },
];

export const mobileSidebarItems: SidebarType[] = [
  { label: "Changing log", href: "/changelog", children: [] },
  { label: "Support", href: "/support", children: [] },
  { label: "Install IDAH", href: "/install", children: [] },
  ...desktopSidebarItems,
];
