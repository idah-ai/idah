<script lang="ts">
  import { MailIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import { Button } from "@/components/ui/button";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";

  // Variables
  const iamResource = AccountRecord.type;
  let showChangeEmail = $state(false);

  // Functions
  function toggleShowChangeEmail() {
    showChangeEmail = !showChangeEmail;
  }
</script>

<Item variant="outline">
  <div class="flex w-full items-center gap-4">
    <ItemMedia variant="icon">
      <MailIcon />
    </ItemMedia>

    <ItemContent class="gap-0">
      <ItemTitle>Email</ItemTitle>
      <ItemDescription class="text-xs">1 unverified emails configured</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Button variant="outline" size="sm" onclick={toggleShowChangeEmail}>Manage</Button>
    </ItemActions>
  </div>

  {#if showChangeEmail}
    <div class="flex w-full flex-col gap-4 pl-12">
      <!-- EMAIL -->
      <InputField name="{iamResource}/email" class="w-1/2" label="Email" value={$authStatus.authContext?.email || ""} />
    </div>
  {/if}
</Item>
