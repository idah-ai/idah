<script lang="ts">
  import { page } from "$app/state";

  import ProjectDashboard from "@/components/app/projects/dashboard/ProjectDashboard.svelte";

  const projectId = $derived(page.params.projectId as string);
</script>

<ProjectDashboard {projectId} />
