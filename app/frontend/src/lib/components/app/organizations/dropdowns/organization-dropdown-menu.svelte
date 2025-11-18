<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    organizationId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { organizationId, align = "center" }: Props = $props();

  // Variables
  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: async () => {
            const organizationRes = await fetchOrganization();
            organizationRecord = organizationRes.data;
            openEditOrganizationFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          action: () => {
            openConfirmDeleteOrganizationModal = true;
          },
        },
      ],
    },
  };

  let organizationRecord: OrganizationRecord | undefined = $state(undefined);
  let openEditOrganizationFormModal: boolean = $state(false);
  let openConfirmDeleteOrganizationModal: boolean = $state(false);

  // Functions
  async function fetchOrganization() {
    return await organizationsBackendDataSource.get(organizationId, {
      fields: {
        [OrganizationRecord.type]: ["name"],
      },
      noCache: true,
    });
  }

  async function deleteOrganization() {
    await organizationsBackendDataSource.delete(organizationId);
    openConfirmDeleteOrganizationModal = false;
    $refetches.organizations.list = new Date();
    goto(resolve("/organizations"));
  }
</script>

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
