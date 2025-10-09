<script lang="ts">
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Props
  interface Props {
    record: ProjectRecord;
  }
  let { record: project }: Props = $props();
</script>

<ProjectDropdownMenu projectId={project.id} />
