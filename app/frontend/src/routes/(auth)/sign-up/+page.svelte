<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { signUpSchema } from "@/data/model/iam/accounts/auth-schema";

  // Variables
  let resource: string = "iam:account";
  let showErrorAlert = $state(false);
  let credentials = $state({
    email: "",
    password: "",
    confirmPassword: "",
  });
  let disabledSignUpButton = $derived.by(() => {
    const validated = signUpSchema.safeParse(credentials);
    return !validated.success;
  });

  // Functions
  async function signUp(): Promise<void> {
    /** Check if email is valid and exist in out platform? */
    // const existingAccount = await AccountsBackendDataSource.list({
    //   fields: {
    //     [AccountRecord.type]: []
    //   }
    //   filters: {
    //     email: credentials.email
    //   },
    //   noCache: true
    // })
    // if (false) {
    //   showErrorAlert = false;
    // } else {
    //   /** Show error that email is already in used */
    //   showErrorAlert = true;
    // }
  }
</script>

<AuthenticationCard title="Create an Account" description="Welcome to IDAH!. Please enter your details.">
  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Email is already in use" description="Please try another email address."
      ></AuthenticationAlert>
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
        bind:value={credentials.email}
      ></InputField>

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
        label="Repeat Password"
        type="password"
        placeholder="Enter your password"
        required
        bind:value={credentials.confirmPassword}
      ></InputField>

      <Button class="w-full" disabled={disabledSignUpButton} onclick={signUp}>Sign Up</Button>
    </Form>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-center gap-2">
      <Text size="sm" class="text-muted-foreground">Already have an account?</Text>
      <Link href="/login" class="text-sm">Login</Link>
    </div>
  {/snippet}
</AuthenticationCard>
