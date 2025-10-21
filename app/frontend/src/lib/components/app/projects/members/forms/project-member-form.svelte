<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";

  import { PlusIcon, Trash2Icon } from "@lucide/svelte";
  import { ProjectMemberRecord, projectMemberAccess } from "@/data/model/dataset/projects/members/record";

  // Props
  interface Props {
    members: Array<{ email: string; access: string }>;
  }
  let { members = $bindable() }: Props = $props();

  // Variables
  const resource: string = ProjectMemberRecord.type;

  // Functions
  function addMember(): void {
    members.push({ email: "", access: "" });
  }

  function removeMember(index: number): void {
    members = members.filter((_, i) => i !== index);
  }
</script>

<Form>
  <!-- EACH MEMBERS -->
  {#each members as member, index}
    <div class="flex w-full items-end gap-4">
      <!-- EMAIL -->
      <InputField
        name="{resource}/email"
        class="flex-1"
        label="Email"
        placeholder="Write an email address"
        required
        bind:value={member.email}
      />

      <!-- ACCESS -->
      <SingleSelectField
        name="{resource}/access"
        class="flex-1"
        label="Access"
        placeholder="Select an access"
        choices={projectMemberAccess}
        required
        searchable
        searchPlaceholder="Search an access"
        bind:value={member.access}
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
</Form>
