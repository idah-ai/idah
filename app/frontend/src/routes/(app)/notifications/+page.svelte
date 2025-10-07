<script lang="ts">
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Variables
  const breadcrumbs: PageBreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Notifications", href: "/notifications" },
  ];
</script>

<PageProvider name="notifications" {breadcrumbs}>
  <PageHeader title="Notifications"></PageHeader>
</PageProvider>
