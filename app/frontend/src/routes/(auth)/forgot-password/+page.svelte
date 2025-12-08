<script lang="ts">

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Link from "@/components/ui/text/Link.svelte";

  import { accountPasswordsBackendDataSource } from "@/data/model/iam/account-passwords/record";
  import { sendResetPasswordLinkSchema } from "@/data/model/iam/accounts/auth-schema";

  // Variables
  let resource: string = "iam:account";
  let email = $state("");
  let showErrorAlert = $state(false);
  let passwordResetLinkHasBeenSent: boolean = $state(false);
  // let sentDate: Date | null = $state(null);
  let disabledSendPasswordResetLink = $derived.by(() => {
    const validated = sendResetPasswordLinkSchema.safeParse({ email });
    return !validated.success;
  });
  let disabledResendPasswordResetLink = $derived.by(() => {
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

<AuthenticationCard title="Welcome Back!" description="We missed you!. Please enter your details.">
  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Unable to send reset link" description="Please try again."></AuthenticationAlert>
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

      <Button class="w-full" disabled={disabledSendPasswordResetLink} onclick={sendPasswordResetLink}>
        {#if passwordResetLinkHasBeenSent}
          Sent! 🎉
        {:else}
          Send Password Reset Link
        {/if}
      </Button>
    </Form>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-2">
      <Link href="/login" class="text-sm">Return to login</Link>
      <Button variant="ghost" disabled={disabledResendPasswordResetLink}>Resend link</Button>
    </div>
  {/snippet}
</AuthenticationCard>
