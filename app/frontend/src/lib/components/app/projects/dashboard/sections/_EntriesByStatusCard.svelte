<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const distribution = $derived(controller.workflowDistribution);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Entries by status</Card.Title>
  </Card.Header>

  <Card.Content>
    {#if controller.summaryLoading || controller.workflowLoading}
      <Spinner size="sm" />
    {:else if distribution}
      <div class="space-y-4">
        <div
          class="bg-muted flex h-4 overflow-hidden rounded-sm"
          role="img"
          aria-label={distribution.groups.map((group) => `${group.label}: ${group.value}`).join("; ") +
            `; ${distribution.residual} outside these workflow groups`}
        >
          {#each distribution.groups as group (group.label)}
            {#if group.value > 0}
              <div
                class={group.bgColor}
                style:width={`${distribution.total ? (group.value / distribution.total) * 100 : 0}%`}
                title={`${group.label}: ${group.value.toLocaleString()}`}
              ></div>
            {/if}
          {/each}
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {#each distribution.groups as group (group.label)}
            <div>
              <Text size="xs" class="inline-flex items-center gap-2">
                <span class={`size-2 shrink-0 rounded-sm ${group.bgColor}`} aria-hidden="true"></span>
                {group.label}
              </Text>
              <Text size="h2" weight="semibold">{group.value.toLocaleString()}</Text>
              <Text size="xs" class="text-muted-foreground">
                {distribution.total ? ((group.value / distribution.total) * 100).toFixed(2) : "0.00"}% of entries
              </Text>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <ResponseBlock
        title="Entries by status unavailable"
        description={controller.summaryError ||
          controller.workflowError ||
          "Workflow counts changed while loading. Please retry."}
      >
        {#snippet actions()}
          <Button
            variant="outline"
            size="sm"
            onclick={() => void (controller.summary ? controller.retryWorkflowCounts() : controller.retrySummary())}
          >
            Retry
          </Button>
        {/snippet}
      </ResponseBlock>
    {/if}
  </Card.Content>
</Card.Root>
