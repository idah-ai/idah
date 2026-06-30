<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import UploadEntryModal from "@/components/app/datasets/entries/overlays/_UploadEntryFormModal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { ProjectMemberScope } from "@/security/types";

  let { class: className = "", showIcon = true }: { class?: string; showIcon?: boolean } = $props();

  // Contexts / scope (same shape entry-dropdown-menu.svelte builds)
  const dataset: DatasetRecord = getContext("dataset");
  const projectId = page.params.projectId as string;
  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: { projectId, projectMemberRoles: ["project_owner"] },
  };

  let open = $state(false);
</script>

<Can action="create" resource="dataset:entries" scopes={["as_org_owner", as_project_owner]}>
  <Button class={className} onclick={() => (open = true)}>
    {#if showIcon}
      <PlusIcon />
    {/if}
    Add Entry
  </Button>

  <UploadEntryModal title="Entry" action="create" modality={dataset.modality} bind:open />
</Can>
