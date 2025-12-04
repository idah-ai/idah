<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import ResetPassword from "@/components/app/response-block/reset-password.svg";
  import Button from "@/components/ui/button/button.svelte";
  import { accountPasswordsBackendDataSource } from "@/data/model/iam/account-passwords/record";

  import { page } from "$app/state";
  import { resetPasswordSchema } from "@/data/model/iam/accounts/auth-schema";
  import { cn } from "@/utils";

  // Variables
  let resource: string = "iam:account";
  let updated: boolean = $state(false);
  let credentials = $state({
    password: "",
    confirmPassword: "",
  });
  let disabledResetPasswordButton = $derived.by(() => {
    const validated = resetPasswordSchema.safeParse(credentials);
    return !validated.success;
  });

  // let accountId = $derived(page.url.);


  // Functions
  async function updatePassword(): Promise<void> {
    const res = accountPasswordsBackendDataSource.reset({token: "", password: credentials.password});
    // if (true) {
    //   updated = true;
    // } else {
    //   updated = false;
    // }
  }

  onMount(async () => { 
    console.log({accountId : page});
    
    
  });
</script>

<AuthenticationCard
  title={updated ? "Password changed successfully!" : "Reset your password"}
  description={updated
    ? "Your password has been updated. You can now login with your new password."
    : "Enter a new password to reset your password."}
>
{#snippet responseBlock()}
    <img class={cn("h-30 p-2 w-full items-center justify-center",{
      "hidden": !updated,
    })} src={ResetPassword} alt="invalid-link" />
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
          bind:value={credentials.password}
        ></InputField>

        <!-- CONFIRM PASSWORD -->
        <InputField
          name="{resource}/confirm_password"
          label="Confirm new password"
          type="password"
          placeholder="Enter your password"
          required
          bind:value={credentials.confirmPassword}
        ></InputField>

        <Button class="w-full" disabled={disabledResetPasswordButton} onclick={updatePassword}>Update Password</Button>
      {:else}      
        <Button class="w-full" onclick={() => goto(resolve("/login"))}>Go to login</Button>
      {/if}
    </Form>
  {/snippet}
</AuthenticationCard>
