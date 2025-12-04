<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Link from "@/components/ui/text/Link.svelte";

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
  async function sendPasswordResetEmail(): Promise<void> {
    /** Check if email is valid and exist in out platform? */
    // const existingAccount = await AccountsBackendDataSource.list({
    //   fields: {
    //     [AccountRecord.type]: []
    //   }
    //   filters: {
    //     email: email
    //   },
    //   noCache: true
    // })
    // if (!existingAccount.data)
    // if (true) {
    //   passwordResetLinkHasBeenSent = true;
    // sentDate = new Date();
    // showErrorAlert = false;
    // goto("/reset-password");
    // } else {
    // showErrorAlert = true;
    // }
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
      />

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
      <Link href="/login" class="text-sm">Return to login</Link>
      <Button variant="ghost" disabled={disabledResendPasswordResetEmail}>Resend link</Button>
    </div>
  {/snippet}
</AuthenticationCard>
