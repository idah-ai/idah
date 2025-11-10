import { writable } from "svelte/store";

import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

export const pageBreadcrumbsStore = writable<PageBreadcrumbItem[]>([]);
