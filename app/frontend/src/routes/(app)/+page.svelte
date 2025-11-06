<script lang="ts">
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";

  import { homeBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  pageBreadcrumbsStore.set([homeBreadcrumb]);
</script>

<PageProvider name="home">
  <PageHeader title="Home"></PageHeader>
</PageProvider>
