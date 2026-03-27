import type { SidebarType } from "$lib/app/sidebar/sidebar.data";

export interface SidebarItem {
  label: string;
  href: string;
}

export function findSidebarItem(items: SidebarType[], result: SidebarItem[] = []): SidebarItem[] {
  for (const item of items) {
    if (item.href && item.selectable !== false) {
      result.push({
        label: item.label,
        href: item.href,
      });
    }

    if (item.children?.length) {
      findSidebarItem(item.children, result);
    }
  }

  return result;
}

/**
 * Recursively checks if a sidebar item has an active child based on the current pathname
 * Now supports query parameter matching for API references
 */
export function hasActiveChild(item: SidebarType, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some((child) => hasActiveChild(child, pathname));
}

/**
 * Merges sidebar items with API references data
 */
export function mergeSidebarItemsWithApiUrls(
  baseSidebarItems: SidebarType[],
  apiUrls: { url: string; name: string; title?: string; tags?: string[] }[],
  onlyVisible = true,
): SidebarType[] {
  const visibleSidebarItems =
    onlyVisible && baseSidebarItems.length > 0
      ? baseSidebarItems.filter((item) => item.visible !== false)
      : baseSidebarItems;

  return [
    ...visibleSidebarItems,
    {
      label: "API Reference",
      children: [
        { label: "Overview", href: "/apis/", children: [] },
        ...apiUrls.map((api) => ({
          label: api.title || api.name,
          href: encodeURI("/apis/" + api.name + "/"),
          selectable: false,
          children:
            api.tags?.map((tag) => ({
              label: tag,
              href: encodeURI("/apis/" + api.name + "/" + tag + "/"),
              children: [],
            })) || [],
        })),
      ],
    },
  ];
}
