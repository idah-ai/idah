<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectMemberColumns } from "@/components/app/projects/members/datasource-tables/project-member-columns";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${project.id}/members`) },
    { label: "Members" },
  ]);

  // Variables
  let projectId = page.params.projectId as string;
  let canDeleteProjectMember = $state(false);
  let columns = $state(projectMemberColumns);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };
    canDeleteProjectMember =
      (await currentAccount?.can("delete", "dataset:project_members", ["as_org_owner", as_project_owner])) || false;
    columns.action.visible = canDeleteProjectMember;
  });
</script>

{#key $refetches.projectMembers.list}
  <DatasourceTable
    id="project-members-{projectId}"
    name="member"
    refetchKey="projectMembers"
    {columns}
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
