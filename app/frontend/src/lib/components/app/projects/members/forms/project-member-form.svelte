<script lang="ts">
  import { PlusIcon, Trash2Icon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";

  // Props
  interface Props {
    members: Array<{ email: string; role: string }>;
  }
  let { members = $bindable() }: Props = $props();

  // Variables
  const resource: string = ProjectMemberRecord.type;

  // Functions
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
      <div class="flex w-full items-end gap-4">
        <!-- EMAIL -->
        <InputField
          name="{resource}/email"
          class="flex-1"
          label="Email"
          placeholder="Write an email address"
          required
          value={member.email}
          oninput={(e) => (member.email = e.currentTarget.value)}
        />

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
        <Button variant="ghost" size="icon" class="mb-1" onclick={() => removeMember(index)}>
          <Trash2Icon class="size-4" />
        </Button>
      </div>
    {/each}

    <div>
      <!-- ADD MORE MEMBERS BUTTON -->
      <Button variant="secondary" onclick={addMember}>
        <PlusIcon class="size-4" />
        Add Members
      </Button>
    </div>
  </FieldGroup>
</FieldSet>
