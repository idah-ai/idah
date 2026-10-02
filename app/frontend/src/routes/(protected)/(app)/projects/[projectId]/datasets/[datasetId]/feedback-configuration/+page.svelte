<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";

  import DatasetFeedbackManagement from "@/components/app/datasets/feedbacks/DatasetFeedbackManagement.svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  const projectId: string = page.params.projectId as string;
  const datasetId: string = page.params.datasetId as string;

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Detasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/feedback-configuration`) },
    { label: "Feedback Configuration" },
  ]);
</script>

<section class="mb-4">
  <Text size="sm" class="text-muted-foreground">
    Reusable feedback reviewers can attach to a note in one click, with an optional comment, instead of retyping the
    same note on every entry, frame, or annotation. Available on the Video and Image
  </Text>
</section>

<DatasetFeedbackManagement />
