<script lang="ts">
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import type { DatasetConfigSchema } from "@/data/model/setting/plugin/types";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import { FieldGroup, FieldSet, FieldSeparator, FieldDescription } from "@/components/ui/field";
  import type { Hash } from "@/utils/types";

  interface Props {
    pluginName: string;
    value: Hash;
    onChange: (value: Hash) => void;
  }
  let { pluginName, value, onChange }: Props = $props();

  let schema = $state<DatasetConfigSchema | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    schema = null;

    pluginsBackendDataSource.datasetConfig(pluginName).then((config) => {
      schema = config;
      loading = false;
    }).catch((err) => {
      error = String(err);
      loading = false;
    });
  });

  function updateField(groupKey: string, fieldKey: string, fieldValue: string | number | boolean | null | undefined): void {
    const updated = { ...value };
    if (!updated[groupKey]) updated[groupKey] = {};
    updated[groupKey] = { ...updated[groupKey], [fieldKey]: fieldValue };
    onChange(updated);
  }
</script>

{#if loading}
  <p class="text-sm text-muted-foreground italic">Loading configuration...</p>
{:else if error}
  <p class="text-sm text-destructive italic">{error}</p>
{:else if schema}
  <FieldSet class="p-1">
    {#each schema.groups as group, gi}
      <FieldGroup>
        <h4 class="text-sm font-medium">{group.label}</h4>
        {#if group.description}
          <FieldDescription>{group.description}</FieldDescription>
        {/if}

        {#each group.fields as fieldDef}
          {#if fieldDef.type === "boolean"}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value?.[group.key]?.[fieldDef.key] === true || fieldDef.default === true}
                onchange={(e) => updateField(group.key, fieldDef.key, (e.currentTarget as HTMLInputElement).checked)}
              />
              {fieldDef.label}
            </label>
          {:else}
            <InputField
              name="workflow_configuration/{group.key}/{fieldDef.key}"
              label={fieldDef.label}
              type={fieldDef.type === "password" ? "password" : fieldDef.type === "number" ? "number" : "text"}
              placeholder={fieldDef.placeholder}
              required={fieldDef.required ?? false}
              description={fieldDef.description}
              value={value?.[group.key]?.[fieldDef.key] ?? fieldDef.default ?? null}
              oninput={(e: Event) => updateField(group.key, fieldDef.key, (e.currentTarget as HTMLInputElement).value)}
            />
          {/if}
        {/each}
      </FieldGroup>

      {#if gi < schema.groups.length - 1}
        <FieldSeparator />
      {/if}
    {/each}
  </FieldSet>
{/if}