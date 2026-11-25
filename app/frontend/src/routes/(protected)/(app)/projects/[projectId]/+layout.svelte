<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { setContext, type Snippet } from "svelte";

  import AddNewDatasetButton from "@/components/app/datasets/buttons/add-new-dataset-button.svelte";
  import SelectedDatasetsDropdownMenu from "@/components/app/datasets/dropdowns/selected-datasets-dropdown-menu.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import ProjectStorageTargetLabel from "@/components/app/projects/storage-target/project-storage-target-label.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Text from "@/components/ui/text/Text.svelte";

  import { selectedDatasets } from "@/components/app/datasets/stores";
  import { projectTabs, type ProjectTab } from "@/components/app/projects/tabs/project.tabs";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { ProjectStorageTargetSummary } from "@/data/model/setting/storage_target/utils";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId = $derived(page.params.projectId as string);
  let activeTab: ProjectTab = $derived(page.url.pathname.split("/").pop() as ProjectTab);

  // Reactive variables
  let isDatasetPage = $derived(page.url.pathname.split("/").length > 4);

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());

  setContext("project", project);

  // Functions
  async function fetchProject(): Promise<{
    project: ProjectRecord;
    storageTarget: ProjectStorageTargetSummary | null;
  }> {
    const requestedProjectId = projectId;
    const projectRes = await projectsBackendDataSource.get(requestedProjectId, {
      fields: {
        [ProjectRecord.type]: ["name", "description", "organization_id", "storage_target_id"],
      },
    });
    if (requestedProjectId === projectId) Object.assign(project, projectRes.data);

    // Only projects in a dedicated storage target say where their files are.
    const storageTarget = (projectRes.meta?.storage_target as ProjectStorageTargetSummary | undefined) ?? null;
    return { project, storageTarget };
  }

  function getProjectPermissions(projectId: string) {
    const currentAccount = $authStatus.authContext;

    return {
      dashboard: Promise.resolve(currentAccount?.canOnProject("read", "dataset:datasets", projectId, "project_owner"))
        .then(Boolean)
        .catch(() => false),
      exports: Promise.resolve(currentAccount?.canOnProject("read", "sync:exports", projectId, "project_owner"))
        .then(Boolean)
        .catch(() => false),
    };
  }

  function handleTabChange(value: ProjectTab): void {
    goto(resolve(`/projects/${projectId}/${value}`));
  }
</script>

{#key $refetches.projects.get}
  {#await fetchProject()}
    <PageLoading />
  {:then { project, storageTarget }}
    {@const permissions = getProjectPermissions(project.id)}
    <PageProvider
      name="project-detail"
      roles={["admin", "org_owner", "user"]}
      action="read"
      resource="dataset:projects"
    >
      {#if !isDatasetPage}
        <PageHeader>
          {#snippet slotTitle()}
            <div class="flex items-center gap-2">
              <Text size="h2" weight="semibold">{project.name}</Text>
              <ProjectDropdownMenu {projectId} align="center" />
            </div>

            {#if project.description}
              <Text class="text-muted-foreground" size="sm">{project.description}</Text>
            {/if}

            {#if storageTarget}
              <ProjectStorageTargetLabel summary={storageTarget} />
            {/if}
          {/snippet}
        </PageHeader>

        <Tabs bind:value={activeTab}>
          <div class="flex items-center gap-4">
            <TabsList>
              {#each projectTabs as { label, value } (value)}
                {#await value === "dashboard" || value === "exports" ? permissions[value] : true then allowed}
                  {#if allowed}
                    <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
                  {/if}
                {/await}
              {/each}
            </TabsList>

            <div class="ml-auto">
              <TabsContent value="datasets">
                <div class="flex items-center gap-2">
                  {#if $selectedDatasets.length}
                    <SelectedDatasetsDropdownMenu />
                  {/if}

                  <AddNewDatasetButton />
                </div>
              </TabsContent>

              <TabsContent value="members">
                <InviteMemberButton />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      {/if}

      {#await activeTab === "dashboard" || activeTab === "exports" ? permissions[activeTab] : true}
        <PageLoading />
      {:then allowed}
        {#if allowed}
          {@render children()}
        {:else}
          <Redirect to={resolve(`/projects/${projectId}/datasets`)} />
        {/if}
      {/await}
    </PageProvider>
  {/await}
{/key}
