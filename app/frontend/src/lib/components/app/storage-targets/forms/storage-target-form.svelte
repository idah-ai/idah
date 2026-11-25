<script lang="ts">
  import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, PlugZapIcon } from "@lucide/svelte";

  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SwitchField from "@/components/app/forms/fields/input/switch-field.svelte";
  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { StorageTargetRecord, storageTargetsBackendDataSource } from "@/data/model/setting/storage_target/record";
  import {
    connectionErrorMessage,
    normalizePrefix,
    storageTargetSaveErrorMessage,
    type ConnectionResult,
  } from "@/data/model/setting/storage_target/utils";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    target: StorageTargetRecord;
    newRecord: boolean;
  }
  let { target, newRecord, fieldErrors, onValueChange }: Props = $props();

  // Variables
  const resource: string = StorageTargetRecord.type;
  const locationLocked = "Can't be changed once saved: the files already stored there would be lost.";

  // Variables::Reactive
  let { name, endpoint, region, bucket, prefix, path_style, access_key_id, organization_ids, enabled } =
    $derived(target);
  let secret_access_key: string = $state("");

  let testing: boolean = $state(false);
  let testResult: ConnectionResult | null = $state(null);
  let testFailure: string = $state("");

  let folder = $derived(normalizePrefix(prefix));

  // Functions
  $effect(() => {
    onValueChange({
      name,
      endpoint,
      region,
      bucket,
      prefix,
      path_style,
      access_key_id,
      secret_access_key,
      organization_ids,
      enabled,
    });
  });

  // Changing what is tested makes the last result stale.
  $effect(() => {
    void [endpoint, region, bucket, prefix, path_style, access_key_id, secret_access_key];
    testResult = null;
    testFailure = "";
  });

  async function testConnection(): Promise<void> {
    testing = true;
    testResult = null;
    testFailure = "";

    try {
      const keepsStoredSecret =
        !newRecord &&
        !secret_access_key.trim() &&
        access_key_id === target.access_key_id &&
        Boolean(path_style) === Boolean(target.path_style);

      testResult = keepsStoredSecret
        ? await storageTargetsBackendDataSource.testSaved(target.id)
        : await storageTargetsBackendDataSource.testConnection({
            endpoint: endpoint?.trim(),
            region: region?.trim() || null,
            bucket: bucket?.trim(),
            prefix: folder,
            path_style: Boolean(path_style),
            access_key_id: access_key_id?.trim(),
            secret_access_key: secret_access_key.trim(),
          });
    } catch (error) {
      testFailure = storageTargetSaveErrorMessage(error);
    } finally {
      testing = false;
    }
  }
</script>

<!-- A form around the secret field, so the browser treats it as part of one (and the dialog saves it, not a
     submit): Chrome warns about password fields outside a form. -->
<form autocomplete="off" onsubmit={(event) => event.preventDefault()}>
  <FieldSet class="p-1">
    <FieldGroup>
      <!-- STORAGE_TARGET::NAME -->
      <InputField
        name="{resource}/name"
        label="Name"
        placeholder="e.g. Acme confidential bucket"
        required
        description="Shown to project creators when they choose where files go."
        errors={fieldErrors["name"]}
        value={name}
        oninput={(e) => (name = e.currentTarget.value)}
      />

      <!-- STORAGE_TARGET::LOCATION -->
      <InputField
        name="{resource}/endpoint"
        label="Endpoint"
        placeholder="https://s3.eu-west-1.amazonaws.com"
        required
        readonly={!newRecord}
        description={newRecord ? "The S3 or S3-compatible service URL." : locationLocked}
        errors={fieldErrors["endpoint"]}
        value={endpoint}
        oninput={(e) => (endpoint = e.currentTarget.value)}
      />

      <div class="grid grid-cols-2 gap-4">
        <InputField
          name="{resource}/bucket"
          label="Bucket"
          placeholder="acme-idah-files"
          required
          readonly={!newRecord}
          errors={fieldErrors["bucket"]}
          value={bucket}
          oninput={(e) => (bucket = e.currentTarget.value)}
        />

        <InputField
          name="{resource}/region"
          label="Region"
          placeholder="eu-west-1"
          readonly={!newRecord}
          errors={fieldErrors["region"]}
          value={region}
          oninput={(e) => (region = e.currentTarget.value)}
        />
      </div>

      <InputField
        name="{resource}/prefix"
        label="Folder"
        placeholder="Optional, e.g. idah"
        readonly={!newRecord}
        description={folder
          ? `Files go under ${folder}/media/files and exports under ${folder}/sync/files.`
          : "Files go under media/files and exports under sync/files."}
        errors={fieldErrors["prefix"]}
        value={prefix}
        oninput={(e) => (prefix = e.currentTarget.value)}
      />

      <SwitchField
        name="{resource}/path_style"
        label="Path-style addressing"
        bordered
        info="Turn on for MinIO, Ceph and most self-hosted S3 services. AWS and Google Cloud Storage don't need it."
        checked={path_style ?? false}
        onCheckedChange={(checked) => (path_style = checked)}
      />

      <!-- STORAGE_TARGET::CREDENTIALS -->
      <InputField
        name="{resource}/access_key_id"
        label="Access key ID"
        placeholder="AKIA…"
        autocomplete="off"
        required
        errors={fieldErrors["access_key_id"]}
        value={access_key_id}
        oninput={(e) => (access_key_id = e.currentTarget.value)}
      />

      <InputField
        name="{resource}/secret_access_key"
        label="Secret key"
        type="password"
        autocomplete="new-password"
        placeholder={newRecord ? "Secret access key" : `Unchanged (ends in ${target.secret_hint ?? "…"})`}
        required={newRecord}
        description={newRecord
          ? "Stored encrypted. It is never shown again."
          : "Leave empty to keep the current secret. A new access key ID needs its secret."}
        errors={fieldErrors["secret_access_key"]}
        value={secret_access_key}
        oninput={(e) => (secret_access_key = e.currentTarget.value)}
      />

      <div class="flex flex-col gap-2">
        <Button variant="outline" class="w-fit" disabled={testing} onclick={testConnection}>
          {#if testing}
            <LoaderCircleIcon class="animate-spin" />
          {:else}
            <PlugZapIcon />
          {/if}
          Test connection
        </Button>

        {#if testResult?.ok}
          <p class="flex items-center gap-2 text-sm text-green-600">
            <CircleCheckIcon class="size-4" />
            A test file was written, read back and deleted.
          </p>
        {:else if testResult}
          <p class="text-destructive flex items-center gap-2 text-sm">
            <CircleXIcon class="size-4 shrink-0" />
            {connectionErrorMessage(testResult.error)}
          </p>
        {:else if testFailure}
          <p class="text-destructive flex items-center gap-2 text-sm">
            <CircleXIcon class="size-4 shrink-0" />
            {testFailure}
          </p>
        {/if}
      </div>

      <!-- STORAGE_TARGET::ORGANIZATIONS: the picker's choices are string ids; the payload wants numbers -->
      <MultipleSelectDatasourceField
        name="{resource}/organization_ids"
        label="Organizations"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        values={(organization_ids ?? []).map(String)}
        placeholder="Select organizations"
        searchKeyWithOperation="name__match"
        clearable
        info="Only these organizations' owners can choose this target for a new project."
        errors={fieldErrors["organization_ids"]}
        onSelected={(selectedChoices) => {
          organization_ids = selectedChoices.map((choice) => Number(choice.value));
        }}
      >
        {#snippet slotTriggerValues({ selectedChoices })}
          <ComboboxTriggerValueBadges
            values={selectedChoices.map((choice) => choice.value)}
            dataSource={organizationsBackendDataSource}
            displayKey="name"
            maxShown={2}
          />
        {/snippet}
      </MultipleSelectDatasourceField>

      <!-- STORAGE_TARGET::ENABLED -->
      <SwitchField
        name="{resource}/enabled"
        label="Offer it for new projects"
        bordered
        info="A disabled target can't be chosen anymore; projects already using it keep working."
        checked={enabled ?? false}
        onCheckedChange={(checked) => (enabled = checked)}
      />
    </FieldGroup>
  </FieldSet>
</form>
