<script lang="ts">
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";

  import { storageTargetsBackendDataSource } from "@/data/model/setting/storage_target/record";
  import { DEFAULT_STORAGE_CHOICE, storageTargetIdFromChoice } from "@/data/model/setting/storage_target/utils";

  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props {
    name: string;
    organizationId: number | null | undefined;
    value: string | null;
    errors?: string[];
    onSelected: (storageTargetId: string | null) => void;
  }
  let { name, organizationId, value, errors, onSelected }: Props = $props();

  // Variables
  const defaultChoice: LabelValue<string> = {
    label: "Default (platform)",
    value: DEFAULT_STORAGE_CHOICE,
    description: "The platform's shared storage.",
  };

  let choices: Array<LabelValue<string>> = $state([]);

  // The targets depend on the organization: only those allowing it are offered.
  $effect(() => {
    const orgId = organizationId;
    if (!orgId) {
      choices = [];
      return;
    }

    let cancelled = false;
    storageTargetsBackendDataSource
      .available({ organizationId: orgId })
      .then((targets) => {
        if (cancelled) return;

        choices = targets.map((target) => ({
          label: target.name,
          value: target.id,
          description: `${target.bucket} · ${target.endpoint}`,
        }));

        // A target chosen for another organization isn't allowed for this one.
        if (value && !targets.some((target) => target.id === value)) onSelected(null);
      })
      .catch(() => {
        if (!cancelled) choices = [];
      });

    return () => {
      cancelled = true;
    };
  });
</script>

<!-- Only shown when the organization has dedicated targets to choose from. -->
{#if choices.length}
  <div class="flex flex-col gap-1.5">
    <SingleSelectField
      {name}
      label="File storage"
      choices={[defaultChoice, ...choices]}
      value={value ?? DEFAULT_STORAGE_CHOICE}
      {errors}
      onSelected={(selected) => onSelected(storageTargetIdFromChoice(selected))}
    />
    <p class="text-muted-foreground text-sm">
      This choice is permanent for this project. All its files and exports will be stored there.
    </p>
  </div>
{/if}
