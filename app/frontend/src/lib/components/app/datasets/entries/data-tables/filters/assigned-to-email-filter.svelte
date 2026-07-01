<script lang="ts" generics="T extends Record">
  import { Combobox } from "bits-ui";

  import UnassignedAvartar from "@/components/app/datasets/entries/data-tables/filters/unassigned-avartar.svelte";
  import ComboboxField from "@/components/app/forms/fields/combobox/combobox-field.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";

  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { Record } from "@/data/model/Record";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { LabelValue } from "@/utils/types";

  // Sentinel value for the "Unassigned" choice (distinct from a real email).
  const UNASSIGNED = "__unassigned__";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<T> = $props();

  // Contexts
  if (!contexts || !("projectId" in contexts)) {
    throw new Error("`projectId` is required in contexts for FilterByProjectMember");
  }
  let { projectId } = contexts as { projectId: string };

  // Filter key → assigned_to_email__match
  const filterKey: string = columnSetting.filterOptions?.filterKey || "assigned_to_email";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "match";
  const emailKey: string = `${filterKey}__${filterOperation}`;

  // Tracks the combobox input text (seeded from the active filter; the wrapper remounts this component
  // when the applied filter changes). Used only to decide Unassigned visibility.
  let inputText: string = $state((filters[emailKey] as string | undefined) ?? "");

  // The currently loaded member choices (from ComboboxField), to tell whether the input is a real member.
  let members: LabelValue<string | number>[] = $state([]);

  // Display flags
  let unassignedActive = $derived(String(filters["assigned"]) === "false");
  // Show "Unassigned" when the input is empty, the text matches its label, or the input is a selected
  // member's email. Hide it only while typing a non-member search like "admin".
  let showUnassigned = $derived(
    !inputText ||
      "unassigned".includes(inputText.toLowerCase()) ||
      members.some((member) => String(member.value) === inputText),
  );

  // Functions — member-pick and free text both write the same key; "" removes it.
  function applyEmail(text: string): void {
    onFilter({ filters: { ...filters, assigned: undefined, [emailKey]: text || undefined } });
  }

  function selectUnassigned(): void {
    onFilter({ filters: { ...filters, [emailKey]: undefined, assigned: false } });
  }

  // Live filtering: apply the typed text to the entries table as you type (debounced). Local timer so
  // it doesn't clash with ComboboxField's shared `delayedInput` (used for the member-list search).
  let applyTimer: ReturnType<typeof setTimeout> | undefined;
  function handleInput(text: string): void {
    inputText = text;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => applyEmail(text), 300);
  }
</script>

{#snippet noLabel()}{/snippet}

<div class="p-2">
  <ComboboxField
    name="assigned-to/email"
    dataSource={projectMembersBackendDataSource}
    class="min-w-64"
    listOptions={{ filters: { project_id: projectId } }}
    searchKeyWithOperation="email__match"
    displayKey="email"
    valueKey="email"
    value={(filters[emailKey] as string | undefined) ?? null}
    placeholder="Select a member or search email"
    clearable
    additionalChoices={showUnassigned ? [{ label: "Unassigned", value: UNASSIGNED }] : []}
    slotLabel={noLabel}
    onSelected={(value) => (value === UNASSIGNED ? selectUnassigned() : applyEmail(String(value ?? "")))}
    onEnter={(text) => applyEmail(text)}
    onInput={handleInput}
    onChoicesChange={(choices) => (members = choices)}
  >
    {#snippet slotChoice({ choice })}
      <Combobox.Item
        class="data-highlighted:bg-muted flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
        value={String(choice.value)}
        label={String(choice.label)}
      >
        {#if choice.value === UNASSIGNED}
          <UnassignedAvartar isSelected={unassignedActive} />
        {:else}
          <AccountAvatar email={String(choice.label)} showEmail size="sm" />
        {/if}
      </Combobox.Item>
    {/snippet}
  </ComboboxField>
</div>
