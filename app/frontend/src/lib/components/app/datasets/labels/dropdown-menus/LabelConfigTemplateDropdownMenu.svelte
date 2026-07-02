<script lang="ts">
  import { ArrowDownIcon, ChevronsUpDownIcon, SaveIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import SaveNewTemplateFormModal from "$lib/components/app/datasets/labels/overlays/SaveNewTemplateFormModal.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  let saveNewTemplateFormModalOpen = $state(false);

  let menus: IDropdownMenus = $state({
    actions: {
      items: [
        {
          label: "Select template",
          icon: ArrowDownIcon,
        },
        {
          label: "Save as a template",
          icon: SaveIcon,
          items: {
            replace: {
              label: "Replace template",
              items: [
                {
                  label: "Template 1",
                },
                {
                  label: "Template 2",
                },
                {
                  label: "Template 3",
                },
              ],
            },
            save: {
              items: [
                {
                  label: "Save new template",
                  action: () => {
                    saveNewTemplateFormModalOpen = true;
                  },
                },
              ],
            },
          },
        },
      ],
    },
  });
</script>

<Can action="update" resource="dataset:labeling_configuration_templates" scopes={["as_org_owner", "as_user"]}>
  <DropdownMenus {menus}>
    {#snippet trigger({ props })}
      <Button {...props} variant="outline" class="w-auto">
        Templates
        <ChevronsUpDownIcon />
      </Button>
    {/snippet}
  </DropdownMenus>
</Can>

<SaveNewTemplateFormModal title="Template" action="create" bind:open={saveNewTemplateFormModalOpen} />
