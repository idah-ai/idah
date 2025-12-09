<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { RectangleEllipsisIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import { Button } from "@/components/ui/button";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

  import { accountPasswordsBackendDataSource } from "@/data/model/iam/account-passwords/record";
  import { updateAccountPasswordSchema } from "@/data/model/iam/account-passwords/schema";
  import { AccountSettingRecord } from "@/data/model/setting/account_setting/record";

  // Variables
  const accountSettingsResource = AccountSettingRecord.type;
  let updatingPassword = $state(false);
  let showChangePassword = $state(false);
  let oldPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");

  let disabledUpdatePasswordButton = $derived.by(() => {
    const validated = updateAccountPasswordSchema.safeParse({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return !validated.success;
  });

  // Functions
  function toggleShowChangePassword() {
    showChangePassword = !showChangePassword;
  }

  function gotoForgotPasswordPage() {
    goto(resolve("/forgot-password"));
  }

  async function updatePassword() {
    updatingPassword = true;

    try {
      await accountPasswordsBackendDataSource.change_password({ oldPassword, newPassword });
      oldPassword = "";
      newPassword = "";
      confirmPassword = "";
      toast.success("Password updated successfully.");
    } catch (error) {
      console.error(error);
      updatingPassword = false;
    }
  }
</script>

<!-- NOTE: Not be visible if the account is SAML login -->
<Item variant="outline" class="flex flex-col gap-4">
  <div class="flex w-full items-center gap-4">
    <ItemMedia variant="icon">
      <RectangleEllipsisIcon />
    </ItemMedia>

    <ItemContent class="gap-0">
      <ItemTitle>Password</ItemTitle>
      <ItemDescription class="text-xs">Configured</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Button variant="outline" size="sm" onclick={toggleShowChangePassword}>
        {showChangePassword ? "Hide" : "Change password"}
      </Button>
    </ItemActions>
  </div>

  {#if showChangePassword}
    <div class="flex w-full flex-col gap-4 pl-12">
      <!-- OLD PASSWORD -->
      <InputField
        name="{accountSettingsResource}/old_password"
        class="w-1/2"
        type="password"
        label="Old password"
        value={oldPassword}
        oninput={(e) => (oldPassword = e.currentTarget.value)}
      />

      <!-- NEW PASSWORD -->
      <InputField
        name="{accountSettingsResource}/new_password"
        class="w-1/2"
        type="password"
        label="New password"
        value={newPassword}
        oninput={(e) => (newPassword = e.currentTarget.value)}
      />

      <!-- CONFIRM PASSWORD -->
      <InputField
        name="{accountSettingsResource}/confirm_password"
        class="w-1/2"
        type="password"
        label="Confirm password"
        value={confirmPassword}
        oninput={(e) => (confirmPassword = e.currentTarget.value)}
      />

      <div class="flex flex-col gap-1">
        <span class="text-muted-foreground text-xs">
          Make sure it's at least 8 characters including a number and a lowercase letter, uppercase letter, special
          character.
        </span>

        <div class="flex items-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={disabledUpdatePasswordButton}
            loading={updatingPassword}
            onclick={updatePassword}
          >
            Update password
          </Button>

          <Button variant="link" size="sm" onclick={gotoForgotPasswordPage}>I forgot my password</Button>
        </div>
      </div>
    </div>
  {/if}
</Item>
