<script lang="ts">
	import PageProvider from "@/components/app/page/page-provider.svelte";
	import PageHeader from "@/components/app/page/page-header.svelte";
</script>

<PageProvider name="home" breadcrumbs={[]}>
	<PageHeader title="Home"></PageHeader>
</PageProvider>
