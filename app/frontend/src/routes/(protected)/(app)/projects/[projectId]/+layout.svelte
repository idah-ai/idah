<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount, setContext, type Snippet } from "svelte";

  import AddNewDatasetButton from "@/components/app/datasets/buttons/add-new-dataset-button.svelte";
  import SelectedDatasetsDropdownMenu from "@/components/app/datasets/dropdowns/selected-datasets-dropdown-menu.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Text from "@/components/ui/text/Text.svelte";

  import { selectedDatasets } from "@/components/app/datasets/stores";
  import { projectTabs, type ProjectTab } from "@/components/app/projects/tabs/project.tabs";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = page.params.projectId as string;
  let tabs = $state(projectTabs);
  let activeTab: ProjectTab = $derived(page.url.pathname.split("/").pop() as ProjectTab);

  // Reactive variables
  let isDatasetPage = $derived(page.url.pathname.split("/").length > 4);

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());

  setContext("project", project);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };
    const canReadExport = await currentAccount?.can("read", "sync:exports", ["as_org_owner", as_project_owner]);

    if (!canReadExport) {
      tabs = projectTabs.filter((tab) => tab.value !== "exports");
    }
  });

  // Functions
  async function fetchProject(): Promise<ProjectRecord> {
    const projectRes = await projectsBackendDataSource.get(projectId, {
      fields: {
        [ProjectRecord.type]: ["name", "description"],
      },
    });
    Object.assign(project, projectRes.data);

    return project;
  }

  function handleTabChange(value: ProjectTab): void {
    goto(resolve(`/projects/${projectId}/${value}`));
  }
</script>

{#key $refetches.projects.get}
  {#await fetchProject()}
    <PageLoading />
  {:then project}
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
            <Text class="text-muted-foreground" size="sm">{project.description}</Text>
          {/snippet}
        </PageHeader>

        <Tabs bind:value={activeTab}>
          <div class="flex items-center gap-4">
            <TabsList>
              {#each tabs as { label, value } (value)}
                <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
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

      {@render children()}
    </PageProvider>
  {/await}
{/key}
