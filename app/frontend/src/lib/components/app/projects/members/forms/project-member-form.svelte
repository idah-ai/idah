<script lang="ts">
  import { page } from "$app/state";
  import { CheckIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";
  import { Combobox } from "bits-ui";

  import ComboboxField from "@/components/app/forms/fields/combobox/combobox-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import {
    ProjectMemberRecord,
    projectMemberRoles,
    projectMembersBackendDataSource,
  } from "@/data/model/dataset/projects/members/record";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { cn } from "@/utils";
  import { onMount } from "svelte";

  // Props
  interface Props {
    members: Array<{ email: string; role: string }>;
  }
  let { members = $bindable() }: Props = $props();

  // Variables
  const resource: string = ProjectMemberRecord.type;

  let projectId = page.params.projectId as string;
  let projectMemberEmails: Array<string> = $state([]);
  let selectedMemberEmails: Array<string> = $derived(members.map((member) => member.email));
  let disabledMemberEmails: Array<string> = $derived([...projectMemberEmails, ...selectedMemberEmails]);

  // Lifecycle
  onMount(() => {
    fetchProjectMembers();
  });

  // Functions
  async function fetchProjectMembers() {
    const projectMembersRes = await projectMembersBackendDataSource.list({
      fields: {
        [ProjectMemberRecord.type]: ["email"],
      },
      filters: {
        project_id: projectId,
      },
    });
    projectMemberEmails = projectMembersRes.data.map((member) => member.email);
  }

  function addMember(): void {
    members.push({ email: "", role: "" });
  }

  function removeMember(index: number): void {
    members = members.filter((_, i) => i !== index);
  }
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- EACH MEMBERS -->
    {#each members as member, index (index)}
      <div class="flex w-full items-end gap-2">
        <!-- EMAIL -->
        <ComboboxField
          name="{resource}/member"
          class="flex-1"
          dataSource={accountsBackendDataSource}
          searchKeyWithOperation="email__match"
          displayKey="email"
          valueKey="email"
          listOptions={{
            filters: {
              role_name__nin: ["system", "admin"],
            },
          }}
          label="Member"
          placeholder="Search account by email"
          required
          value={member.email}
          onSelected={(selectedValue) => {
            member.email = selectedValue as string;
          }}
        >
          {#snippet slotChoice({ choice, select })}
            {@const isSelected = choice.value === member.email}
            {@const isAlreadyAdded = disabledMemberEmails.includes(String(choice.value))}
            <Combobox.Item
              class={cn(
                "rounded-button data-highlighted:bg-muted outline-hidden flex w-full select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                {
                  "text-muted-foreground cursor-not-allowed": choice.disabled || isAlreadyAdded,
                },
              )}
              value={String(choice.value)}
              label={choice.label}
              disabled={choice.disabled || isAlreadyAdded}
              onclick={() => select(choice)}
            >
              {choice.label}

              <div class="ml-auto">
                {#if isSelected}
                  <CheckIcon class="size-4" />
                {/if}

                {#if isAlreadyAdded}
                  <Badge variant="outline" rounded="full">Already added</Badge>
                {/if}
              </div>
            </Combobox.Item>
          {/snippet}
        </ComboboxField>

        <!-- ROLE -->
        <SingleSelectField
          name="{resource}/role"
          class="flex-1"
          label="Role"
          placeholder="Select a role"
          choices={projectMemberRoles}
          required
          searchable
          searchPlaceholder="Search a role"
          value={member.role}
          onSelected={(selectedValue) => {
            member.role = selectedValue as string;
          }}
        />

        <!-- REMOVE MEMBER BUTTON -->
        <Button variant="ghost" size="icon" onclick={() => removeMember(index)}>
          <Trash2Icon />
        </Button>
      </div>
    {/each}

    <div>
      <!-- ADD MORE MEMBERS BUTTON -->
      <Button variant="secondary" onclick={addMember}>
        <PlusIcon />
        Add Members
      </Button>
    </div>
  </FieldGroup>
</FieldSet>
