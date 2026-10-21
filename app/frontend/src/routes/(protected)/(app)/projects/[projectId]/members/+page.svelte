<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import InviteMemberButton from "@/components/app/projects/members/buttons/invite-member-button.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectMemberColumns } from "@/components/app/projects/members/datasource-tables/project-member-columns";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { CollectionResponse } from "@/data/model/types";

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
    canDeleteProjectMember =
      (await currentAccount?.canOnProject("delete", "dataset:project_members", projectId, "project_owner")) || false;
    columns.action.visible = canDeleteProjectMember;
  });

  // Resolve each member's account joined status on read so the row action cell
  // can offer "Resend invitation" only for accounts that have not joined.
  async function loadAccountJoinedAt(
    response: CollectionResponse<ProjectMemberRecord>,
  ): Promise<{ accountJoinedAt: Record<number, Date | null> }> {
    const accountIds = Array.from(new Set(response.data.map((member) => member.account_id)));
    if (accountIds.length === 0) return { accountJoinedAt: {} };

    const accountsRes = await accountsBackendDataSource.list({
      fields: {
        [AccountRecord.type]: ["id", "joined_at"],
      },
      filters: {
        id__in: accountIds,
      },
      noCache: true,
    });

    const accountJoinedAt: Record<number, Date | null> = {};
    accountsRes.data.forEach((account) => {
      accountJoinedAt[Number(account.id)] = account.joined_at;
    });

    return { accountJoinedAt };
  }
</script>

{#key $refetches.projectMembers.list}
  <DatasourceTable
    id="project-members-{projectId}"
    name="member"
    refetchKey="projectMembers"
    {columns}
    dataSource={projectMembersBackendDataSource}
    onLoadSetContexts={loadAccountJoinedAt}
    listOptions={{
      fields: {
        [ProjectMemberRecord.type]: ["id", "account_id", "project_id", "email", "role", "invited_by_id", "created_at"],
      },
      filters: {
        project_id: projectId,
        enabled: true,
      },
    }}
  >
    {#snippet addNewRecordButton()}
      <InviteMemberButton />
    {/snippet}
  </DatasourceTable>
{/key}
