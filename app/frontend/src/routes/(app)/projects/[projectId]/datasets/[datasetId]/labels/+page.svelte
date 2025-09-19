<script lang="ts">
  import { page } from "$app/state";

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId: string = page.params.datasetId as string;
</script>

<div class="p-6">
  <h2 class="text-2xl font-bold mb-4">Label Editor</h2>
  <p class="text-gray-600">Dataset-specific label editor for dataset {datasetId} in project {projectId}</p>
</div>
