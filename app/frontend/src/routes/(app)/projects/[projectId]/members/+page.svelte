<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";

  import { projectMemberColumns } from "@/components/app/projects/members/datasource-tables/project-member-columns";
  import { refetches } from "@/utils/refetch";

  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Contexts
  const project: ProjectRecord = getContext("project");

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${project.id}/members`) },
    { label: "Members" },
  ]);

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
</script>

{#key $refetches.projectMembers.list}
  <DatasourceTable
    id="project-members-{projectId}"
    name="member"
    refetchKey="projectMembers"
    columns={projectMemberColumns}
    dataSource={projectMembersBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
    }}
  >
    {#snippet addNewRecordButton()}
      <InviteMemberButton />
    {/snippet}
  </DatasourceTable>
{/key}
