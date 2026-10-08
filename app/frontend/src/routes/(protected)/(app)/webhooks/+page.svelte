<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import WebhookFormModal from "@/components/app/notification/webhook/overlays/webhook-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { webhookColumns } from "@/components/app/notification/webhook/data-tables/webhook-columns";
  import { webhookBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { WebhookRecord, webhookResource, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  pageBreadcrumbsStore.set([webhookBreadcrumb]);

  // Variables
  let currentAccount = $authStatus.authContext;
  let openNewWebhookFormModal: boolean = $state(false);
  let columns = $state(webhookColumns);
  let canUpdateWebhook = $state(false);
  let canDeleteWebhook = $state(false);

  // Functions
  function openNewWebhookModal(): void {
    openNewWebhookFormModal = true;
  }

  onMount(async () => {
    canUpdateWebhook = (await currentAccount?.can("update", webhookResource)) || false;
    canDeleteWebhook = (await currentAccount?.can("delete", webhookResource)) || false;
    columns.action.visible = canUpdateWebhook || canDeleteWebhook;
  });
</script>

{#snippet AddNewWebhookButton()}
  <Can action="create" resource={webhookResource}>
    <Button onclick={openNewWebhookModal}>
      <PlusIcon />
      New Webhook
    </Button>

    <WebhookFormModal action="create" title="Webhook" bind:open={openNewWebhookFormModal} />
  </Can>
{/snippet}

<PageProvider name="Webhooks" roles={["admin", "org_owner"]} action="read" resource={webhookResource}>
  <PageHeader title="Webhooks">
    {#snippet actions()}
      {@render AddNewWebhookButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.webhooks.list}
    <DatasourceTable
      id="webhooks"
      name="webhooks"
      refetchKey="webhooks"
      {columns}
      dataSource={webhooksBackendDataSource}
      listOptions={{
        fields: {
          [WebhookRecord.type]: ["id", "name", "url", "event_types", "enabled", "created_at"],
        },
      }}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewWebhookButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
