<script lang="ts">
  import { page } from "$app/state";
  import { CheckIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";
  import { Combobox } from "bits-ui";
  import { onMount } from "svelte";

  import ComboboxField from "@/components/app/forms/fields/combobox/combobox-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import {
    ProjectMemberRecord,
    projectMemberRoles,
    projectMembersBackendDataSource,
    type ProjectMemberRole,
  } from "@/data/model/dataset/projects/members/record";
  import { assignProjectMemberRoleSchema } from "@/data/model/dataset/projects/members/schema";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { cn } from "@/utils";
  import { getFieldErrors, validateData } from "@/utils/validate";

  // Props
  interface Props {
    members: Array<{ email: string; role: ProjectMemberRole | null; errors?: string[] }>;
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
  async function fetchProjectMembers(): Promise<void> {
    const projectMembersRes = await projectMembersBackendDataSource.list({
      fields: {
        [ProjectMemberRecord.type]: ["email"],
      },
      filters: {
        project_id: projectId,
        enabled: true,
      },
    });
    projectMemberEmails = projectMembersRes.data.map((member) => member.email);
  }

  function addMember(): void {
    members.push({ email: "", role: null });
  }

  function removeMember(index: number): void {
    members = members.filter((_, i) => i !== index);
  }

  function checkEmailValidate(member: { email: string; role: ProjectMemberRole | null; errors?: string[] }): void {
    const validationResult = validateData(assignProjectMemberRoleSchema, {
      email: member.email,
    });
    if (!validationResult.success) {
      member.errors = getFieldErrors(validationResult.error)?.email || [];
    } else {
      member.errors = [];
    }
  }
</script>

{#snippet noLabel()}{/snippet}

<FieldSet class="p-1">
  <FieldGroup>
    <!-- EACH MEMBERS -->
    {#each members as member, index (index)}
      <div class="flex w-full items-start gap-2">
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
              role_name__nin: ["system", "admin", "api_service"],
            },
            noCache: true,
          }}
          label="Member"
          slotLabel={index === 0 ? undefined : noLabel}
          placeholder="Search account by email"
          required
          value={member.email}
          errors={member.errors}
          onSelected={(selectedValue) => {
            member.email = (selectedValue ?? "") as string;
            checkEmailValidate(member);
          }}
          onInput={() => {
            checkEmailValidate(member);
          }}
        >
          {#snippet slotChoice({ choice })}
            {@const isAlreadyAdded =
              disabledMemberEmails.includes(String(choice.value)) && choice.value !== member.email}
            {@const isSelected = choice.value === member.email}
            <Combobox.Item
              class={cn(
                "rounded-button data-highlighted:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
                {
                  "text-muted-foreground cursor-not-allowed": choice.disabled || isAlreadyAdded,
                },
              )}
              value={String(choice.value)}
              label={choice.label}
              disabled={choice.disabled || isAlreadyAdded}
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
          slotLabel={index === 0 ? undefined : noLabel}
          placeholder="Select a role"
          choices={projectMemberRoles}
          required
          searchable
          searchPlaceholder="Search a role"
          value={member.role}
          onSelected={(selectedValue) => {
            member.role = selectedValue as ProjectMemberRole | null;
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
