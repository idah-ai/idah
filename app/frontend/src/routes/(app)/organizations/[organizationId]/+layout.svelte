<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { setContext, type Snippet } from "svelte";

  import AddOrgOwnersButton from "@/components/app/organizations/buttons/add-org-owners-button.svelte";
  import OrganizationDropdownMenu from "@/components/app/organizations/dropdowns/organization-dropdown-menu.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import AddNewProjectButton from "@/components/app/projects/buttons/add-new-project-button.svelte";

  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  type OrganizationTab = "projects" | "owners";
  let organizationId = $derived(page.params.organizationId as string);
  let activeTab = $derived(page.url.pathname.split("/").pop() as OrganizationTab);

  const organizationTabs: BaseTabs<OrganizationTab> = [
    { label: "Projects", value: "projects" },
    { label: "Owners", value: "owners" },
  ];

  // Records
  let organization: OrganizationRecord = $state(new OrganizationRecord());

  $effect(() => {
    setContext("organization", organization);
  });

  // Functions
  async function fetchOrganization() {
    const organizationRes = await organizationsBackendDataSource.get(organizationId, {
      fields: {
        "iam/organizations": ["name"],
      },
    });
    organization = organizationRes.data;
    return organizationRes.data;
  }

  function handleTabChange(value: OrganizationTab): void {
    goto(resolve(`/organizations/${organizationId}/${value}`));
  }
</script>

{#key $refetches.organizations.list}
  {#await fetchOrganization()}
    <PageLoading />
  {:then organization}
    <PageProvider name="organization-detail">
      <PageHeader title={organization.name}>
        {#snippet actions()}
          <OrganizationDropdownMenu {organizationId} align="end" />
        {/snippet}
      </PageHeader>

      <Tabs bind:value={activeTab}>
        <div class="flex items-center gap-4">
          <TabsList>
            {#each organizationTabs as { label, value } (value)}
              <TabsTrigger {value} onclick={() => handleTabChange(value)}>
                {label}
              </TabsTrigger>
            {/each}
          </TabsList>

          <div class="ml-auto">
            <TabsContent value="projects">
              <AddNewProjectButton />
            </TabsContent>

            <TabsContent value="owners">
              <AddOrgOwnersButton />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {@render children()}
    </PageProvider>
  {/await}
{/key}
