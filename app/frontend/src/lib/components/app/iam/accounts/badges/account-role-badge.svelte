<script lang="ts">
  import { onMount } from "svelte";

  import ProjectMemberRoleBadge from "@/components/app/projects/members/badges/project-member-role-badge.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
  import Text from "@/components/ui/text/Text.svelte";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { roles } from "@/data/model/iam/accounts/constants";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";

  import type { Role } from "@/data/model/iam/accounts/auth/constants";

  // Props
  interface Props {
    accountRecord: AccountRecord;
    class?: string | null;
  }
  let { accountRecord, class: className }: Props = $props();

  // Lifecycle
  onMount(async () => {
    await Promise.all([
      fetchOrganizations(accountRecord.role_scope.org as Array<string> | undefined),
      fetchProjectMembers(accountRecord.id),
    ]);
  });

  // Variables
  let belongsToOrganization: OrganizationRecord[] = [];
  let belongsToProjectMembers: ProjectMemberRecord[] = [];

  let { role_name } = $derived(accountRecord);
  let roleName = $derived.by(() => {
    if (!role_name) return "Unassigned";
    const foundRole = roles.find((role) => role.value === role_name);
    return foundRole ? foundRole.label : humanize(role_name);
  });

  let rolesRequireMoreInfo: Array<Role> = ["org_owner", "user"];
  let hoverable = $derived.by(() => {
    if (!role_name) return false;
    return rolesRequireMoreInfo.includes(role_name);
  });

  // Functions
  async function fetchOrganizations(ids: Array<string> | undefined) {
    if (!ids || !ids.length) {
      belongsToOrganization = [];
      return;
    }

    const organizationsRes = await organizationsBackendDataSource.list({
      fields: {
        [OrganizationRecord.type]: ["id", "name"],
      },
      filters: {
        id: ids,
      },
    });
    belongsToOrganization = organizationsRes.data;
  }

  async function fetchProjectMembers(accountId: string) {
    const projectMembersRes = await projectMembersBackendDataSource.list({
      fields: {
        [ProjectMemberRecord.type]: ["id", "role"],
        [ProjectRecord.type]: ["id", "name"],
      },
      filters: {
        account_id: accountId,
      },
      included: ["project"],
    });
    belongsToProjectMembers = projectMembersRes.data;
  }
</script>

{#snippet RoleBadge()}
  <Badge
    variant="outline"
    rounded="full"
    class={cn(
      {
        "hover:bg-accent hover:text-accent-foreground cursor-pointer": hoverable,
      },
      className,
    )}
  >
    {roleName}
  </Badge>
{/snippet}

{#snippet HoverCardTitle(title: string)}
  <Text size="sm" weight="semibold">{title}</Text>
{/snippet}

{#snippet Content(content: string)}
  <Text size="xs">{content}</Text>
{/snippet}

{#snippet NoContent(content: string)}
  <Text size="xs" class="text-muted-foreground">{content}</Text>
{/snippet}

{#if hoverable}
  <HoverCard openDelay={200}>
    <HoverCardTrigger>
      {@render RoleBadge()}
    </HoverCardTrigger>

    <HoverCardContent class="w-auto max-w-64 min-w-40 p-2" align="center" sideOffset={8}>
      <div class="flex flex-col gap-1">
        {#if role_name === "org_owner"}
          {@render HoverCardTitle("Organizations")}

          {#each belongsToOrganization as organizationRecord (organizationRecord.id)}
            {@render Content(organizationRecord.name)}
          {:else}
            {@render NoContent("Not an owner of any organization yet")}
          {/each}
        {:else if role_name === "user"}
          {@render HoverCardTitle("Projects")}

          {#each belongsToProjectMembers as projectMemberRecord (projectMemberRecord.id)}
            <div class="flex w-full items-center justify-between gap-4">
              {@render Content(projectMemberRecord.project.name)}
              <ProjectMemberRoleBadge {projectMemberRecord} />
            </div>
          {:else}
            {@render NoContent("Not a member of any project yet")}
          {/each}
        {/if}
      </div>
    </HoverCardContent>
  </HoverCard>
{:else}
  {@render RoleBadge()}
{/if}
