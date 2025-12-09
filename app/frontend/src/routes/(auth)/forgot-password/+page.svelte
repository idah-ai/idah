<script lang="ts">
  import { ArrowLeftIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { accountPasswordsBackendDataSource } from "@/data/model/iam/account-passwords/record";
  import { sendResetPasswordLinkSchema } from "@/data/model/iam/accounts/auth-schema";
  import { AccountRecord } from "@/data/model/iam/accounts/record";

  // Variables
  let resource = AccountRecord.type;
  let email = $state("");
  let showErrorAlert = $state(false);
  let passwordResetLinkHasBeenSent: boolean = $state(false);
  // let sentDate: Date | null = $state(null);
  let disabledSendPasswordResetEmail = $derived.by(() => {
    const validated = sendResetPasswordLinkSchema.safeParse({ email });
    return !validated.success;
  });
  let disabledResendPasswordResetEmail = $derived.by(() => {
    return !passwordResetLinkHasBeenSent;
  });

  // Functions
  async function sendPasswordResetLink(): Promise<void> {
    try {
      await accountPasswordsBackendDataSource.request_reset({ email });
      passwordResetLinkHasBeenSent = true;
      showErrorAlert = false;
    } catch (error) {
      console.error(error);
      showErrorAlert = true;
    }
  }
</script>

<AuthenticationCard
  title="Reset your password"
  description="Enter your user account's verified email address and we will send you a password reset link."
>
  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Unable to send reset link" description="Please try again." />
    {/if}
  {/snippet}

  {#snippet content()}
    <Form>
      <!-- EMAIL -->
      <InputField
        name="{resource}/email"
        label="Email"
        placeholder="Enter your email"
        required
        value={email}
        oninput={(e) => (email = e.currentTarget.value)}
      ></InputField>

      <Button class="w-full" disabled={disabledSendPasswordResetEmail} onclick={sendPasswordResetEmail}>
        {#if passwordResetLinkHasBeenSent}
          Sent! 🎉
        {:else}
          Send password reset email
        {/if}
      </Button>
    </Form>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-2">
      <Button variant="link" class="p-2 text-sm" onclick={goBack}>
        <ArrowLeftIcon />
        Back
      </Button>

      <Button variant="ghost" disabled={disabledResendPasswordResetEmail}>Resend link</Button>
    </div>
  {/snippet}
</AuthenticationCard>
