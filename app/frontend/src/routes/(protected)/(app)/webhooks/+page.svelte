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

  import { webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
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
    canUpdateWebhook = (await currentAccount?.can("update", "iam:organizations")) || false;
    canDeleteWebhook = (await currentAccount?.can("delete", "iam:organizations")) || false;
    columns.action.visible = canUpdateWebhook || canDeleteWebhook;
  });
</script>

{#snippet AddNewWebhookButton()}
  <Can action="create" resource="iam:organizations">
    <Button onclick={openNewWebhookModal}>
      <PlusIcon />
      New Webhook
    </Button>

    <WebhookFormModal action="create" title="Webhook" bind:open={openNewWebhookFormModal} />
  </Can>
{/snippet}

<PageProvider name="Webhooks" roles={["admin", "org_owner"]} action="read" resource="iam:organizations">
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
          ["webhooks"]: ["id", "name", "url", "event_type", "secret_key", "enabled", "created_at"],
        },
      }}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewWebhookButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
