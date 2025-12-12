<script lang="ts">
  import PageHeader from "@/components/app/page/page-header.svelte";

  import { homeBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  pageBreadcrumbsStore.set([homeBreadcrumb]);
</script>

<PageHeader title="Home" />
