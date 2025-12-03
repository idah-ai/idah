<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Variables
  let openNewDatasetModal: boolean = $state(false);

  // Functions
  function openNewDatasetDialog(): void {
    openNewDatasetModal = true;
  }
</script>

<Button onclick={openNewDatasetDialog}>
  <PlusIcon />
  New Dataset
</Button>

<DatasetFormModal title="Dataset" action="create" bind:open={openNewDatasetModal} />
