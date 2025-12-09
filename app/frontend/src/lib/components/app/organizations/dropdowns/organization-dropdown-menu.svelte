<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    organizationId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { organizationId, align = "center" }: Props = $props();

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights(), fetchOrganization(), loadRelatedProjects()]);
  });

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateOrganization = $state(false);
  let canDeleteOrganization = $state(false);
  let organizationRecord: OrganizationRecord | undefined = $state(undefined);
  let relatedProjectRecords: ProjectRecord[] = $state([]);
  let openEditOrganizationFormModal: boolean = $state(false);
  let openConfirmDeleteOrganizationModal: boolean = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateOrganization,
          action: async () => {
            await fetchOrganization();
            openEditOrganizationFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          hidden: !canDeleteOrganization,
          description:
            relatedProjectRecords.length > 0 ? "Cannot delete organization when projects are associated." : undefined,
          disabled: relatedProjectRecords.length > 0,
          action: () => {
            openConfirmDeleteOrganizationModal = true;
          },
        },
      ],
    },
  });

  // Functions
  async function checkRights() {
    canUpdateOrganization = (await currentAccount?.can("update", "iam:organizations")) || false;
    canDeleteOrganization = (await currentAccount?.can("delete", "iam:organizations")) || false;
  }

  async function fetchOrganization() {
    const organizationRes = await organizationsBackendDataSource.get(organizationId, {
      fields: {
        [OrganizationRecord.type]: ["name"],
      },
      noCache: true,
    });
    organizationRecord = organizationRes.data;
    return organizationRecord;
  }

  async function loadRelatedProjects() {
    const projectsRes = await projectsBackendDataSource.list({
      filters: {
        organization_id: organizationId,
      },
    });
    relatedProjectRecords = projectsRes.data;
    return projectsRes.data;
  }

  async function deleteOrganization() {
    await organizationsBackendDataSource.delete(organizationId);
    openConfirmDeleteOrganizationModal = false;
    $refetches.organizations.list = new Date();
    goto(resolve("/organizations"));
  }
</script>

{#if canUpdateOrganization || canDeleteOrganization}
  <DropdownMenus {menus} {align} />

  <OrganizationFormModal
    title="Organization"
    action="update"
    {organizationRecord}
    bind:open={openEditOrganizationFormModal}
  />

  <ConfirmModal
    title="Delete Organization"
    description="Are you sure you want to delete this organization? This action cannot be undone."
    onConfirm={deleteOrganization}
    bind:open={openConfirmDeleteOrganizationModal}
  />
{/if}
