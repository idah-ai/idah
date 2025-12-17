<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import ResetPassword from "@/components/app/response-block/reset-password.svg";
  import Button from "@/components/ui/button/button.svelte";

  import { accountPasswordsBackendDataSource } from "@/data/model/iam/account-passwords/record";
  import { resetPasswordSchema } from "@/data/model/iam/accounts/auth-schema";
  import { cn } from "@/utils";

  // Variables
  let resource: string = "iam:account";
  let updated: boolean = $state(false);
  let credentials = $state({
    password: "",
    confirmPassword: "",
  });
  let updatingPassword = $state(false);
  let disabledResetPasswordButton = $derived.by(() => {
    const validated = resetPasswordSchema.safeParse(credentials);
    return !validated.success;
  });

  let showErrorAlert = $state(false);
  let token = $derived(page.url.searchParams.get("token") as string);

  // Functions
  async function updatePassword(): Promise<void> {
    updatingPassword = true;

    try {
      await accountPasswordsBackendDataSource.reset({ token, password: credentials.password });

      updated = true;
      updatingPassword = false;
      showErrorAlert = false;
    } catch (error) {
      updatingPassword = false;
      updated = false;
      showErrorAlert = true;

      if (error instanceof Error) {
        console.error("Error resetting password:", error.message);
      } else {
        console.error("Unknown error resetting password:", error);
      }
    }
  }
</script>

<AuthenticationCard
  title={updated ? "Password changed successfully!" : "Reset your password"}
  description={updated
    ? "Your password has been updated. You can now login with your new password."
    : "Enter a new password to reset your password."}
>
  {#snippet responseBlock()}
    <img
      class={cn("h-30 w-full items-center justify-center p-2", {
        hidden: !updated,
      })}
      src={ResetPassword}
      alt="invalid-link"
    />
  {/snippet}

  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Invalid token or password" description="Please try again." />
    {/if}
  {/snippet}

  {#snippet content()}
    <Form>
      {#if !updated}
        <!-- PASSWORD -->
        <InputField
          name="{resource}/password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          required
          value={credentials.password}
          oninput={(e) => (credentials.password = e.currentTarget.value)}
        ></InputField>

        <!-- CONFIRM PASSWORD -->
        <InputField
          name="{resource}/confirm_password"
          label="Confirm new password"
          type="password"
          placeholder="Enter your password"
          required
          value={credentials.confirmPassword}
          oninput={(e) => (credentials.confirmPassword = e.currentTarget.value)}
          description="Password must contain at least 8 characters, one lowercase letter, one uppercase letter, one number and one special character."
        ></InputField>

        <Button
          class="w-full"
          type="submit"
          disabled={disabledResetPasswordButton}
          loading={updatingPassword}
          loadingLabel="Updating..."
          onclick={updatePassword}>Update Password</Button
        >
      {:else}
        <Button class="w-full" onclick={() => goto(resolve("/login"))}>Go to login</Button>
      {/if}
    </Form>
  {/snippet}
</AuthenticationCard>
