import type { SidebarType } from "$lib/app/sidebar/sidebar.data";

export type SidebarItem = {
  label: string;
  href: string;
};

export function findSidebarItem(items: SidebarType[], result: SidebarItem[] = []): SidebarItem[] {
  for (const item of items) {
    if (item.href) {
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
