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
 * Checks if a URL matches or is a parent of the current pathname
 * Handles query parameters properly
 */
function matchesPathWithQuery(itemHref: string, pathname: string): boolean {
  // Exact match
  if (itemHref === pathname) return true;

  // Parse URLs to compare base path and query parameters
  try {
    const itemUrl = new URL(itemHref, "http://dummy");
    const pathUrl = new URL(pathname, "http://dummy");

    // Base paths must match
    if (itemUrl.pathname !== pathUrl.pathname) return false;

    // Check if all query parameters from itemHref exist in pathname
    const itemParams = itemUrl.searchParams;
    const pathParams = pathUrl.searchParams;

    for (const [key, value] of itemParams.entries()) {
      if (pathParams.get(key) !== value) {
        return false;
      }
    }

    // If pathname has more parameters than itemHref, it's a child
    return true;
  } catch {
    // Fallback to string comparison if URL parsing fails
    return itemHref === pathname;
  }
}

/**
 * Recursively checks if a sidebar item has an active child based on the current pathname
 * Now supports query parameter matching for API references
 */
export function hasActiveChild(item: SidebarType, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some(
    (child) => matchesPathWithQuery(child.href || "", pathname) || hasActiveChild(child, pathname),
  );
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
      label: "API References",
      children: apiUrls.map((api) => ({
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
    },
  ];
}
