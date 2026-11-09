<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";

  import DatasetFeedbackManagement from "@/components/app/datasets/feedbacks/DatasetFeedbackManagement.svelte";
  import Can from "@/security/can.svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import type { ProjectMemberScope } from "@/security/types";

  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  const projectId: string = page.params.projectId as string;
  const datasetId: string = page.params.datasetId as string;
  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: { projectId, projectMemberRoles: ["project_owner"] },
  };

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/feedback-configuration`) },
    { label: "Feedback Configuration" },
  ]);
</script>

<section class="mb-4">
  <Text size="sm" class="text-muted-foreground">Pre-configured feedback reviewers can attach to notes.</Text>
</section>

<Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
  <DatasetFeedbackManagement />
</Can>
