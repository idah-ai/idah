import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

export const homeBreadcrumb: PageBreadcrumbItem = { label: "Home", href: "/" };

/** IAM */
export const accountBreadcrumb: PageBreadcrumbItem = { label: "Accounts", href: "/accounts" };

/** DATASETS */
export const projectBreadcrumb: PageBreadcrumbItem = { label: "Projects", href: "/projects" };
export const organizationBreadcrumb: PageBreadcrumbItem = { label: "Organizations", href: "/organizations" };
