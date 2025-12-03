<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { setContext, type Snippet } from "svelte";

  import AddNewDatasetButton from "@/components/app/datasets/buttons/add-new-dataset-button.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { projectTabs, type ProjectTab } from "@/components/app/projects/tabs/project.tabs";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  let projectId: string = page.params.projectId as string;
  let activeTab: ProjectTab = $derived(page.url.pathname.split("/").pop() as ProjectTab);

  // Reactive variables
  let isDatasetPage = $derived(page.url.pathname.split("/").length > 4);

  // Records
  let project: ProjectRecord = $state(new ProjectRecord());

  $effect(() => {
    setContext("project", project);
  });

  // Functions
  async function fetchProject() {
    const projectRes = await projectsBackendDataSource.get(projectId, {
      fields: {
        "datasets/projects": ["name"],
      },
    });
    project = projectRes.data;
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
    <PageProvider name="project-detail" roles={["admin", "org_owner", "user"]}>
      {#if !isDatasetPage}
        <PageHeader title={project.name} description={project.description}>
          {#snippet actions()}
            <ProjectDropdownMenu {projectId} align="end" />
          {/snippet}
        </PageHeader>

        <Tabs bind:value={activeTab}>
          <div class="flex items-center gap-4">
            <TabsList>
              {#each projectTabs as { label, value } (value)}
                <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
              {/each}
            </TabsList>

            <div class="ml-auto">
              <TabsContent value="datasets">
                <AddNewDatasetButton />
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
