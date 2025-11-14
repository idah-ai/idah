<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { loginSchema } from "@/data/model/iam/accounts/auth-schema";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext } from "@/security/AuthContext";

  // Variables
  let resource: string = "iam:account";
  let showErrorAlert = $state(false);
  let signingIn = $state(false);
  let email = $state("");
  let password = $state("");
  let disabledSignInButton = $derived.by(() => {
    const validated = loginSchema.safeParse({ email: email, password: password });
    return !validated.success;
  });
  let redirectTo = page.url.searchParams.get("redirectTo") || "/";

  AuthContext.backend ||= accountAuthService();

  // Functions
  async function signInWithEmailAndPassword(): Promise<void> {
    signingIn = true;

    try {
      await AuthContext.signInWithEmailAndPassword(email, password);
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      goto(redirectTo);
    } catch (_error) {
      signingIn = false;
      showErrorAlert = true;
    }
  }
</script>

<AuthenticationCard title="Welcome Back!" description="We missed you!. Please enter your details.">
  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Incorrect email or password" description="Please try again." />
    {/if}
  {/snippet}

  {#snippet content()}
    <Form>
      <!-- EMAIL -->
      <InputField
        name="{resource}/email"
        label="Email"
        placeholder="Enter your email"
        value={email}
        oninput={(e) => (email = e.currentTarget.value)}
      />

      <!-- PASSWORD -->
      <InputField
        name="{resource}/password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={password}
        oninput={(e) => (password = e.currentTarget.value)}
      />

      <div class="flex items-center justify-end">
        <Link href="/forgot-password" class="text-primary text-sm">Forgot password?</Link>
      </div>

      <Button
        type="submit"
        class="w-full"
        loading={signingIn}
        loadingLabel="Signing In..."
        disabled={disabledSignInButton}
        onclick={signInWithEmailAndPassword}
      >
        Sign In
      </Button>
    </Form>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-center gap-2">
      <Text size="sm" class="text-muted-foreground">Don't have an account?</Text>
      <Link href="/sign-up" class="text-sm">Sign up</Link>
    </div>
  {/snippet}
</AuthenticationCard>
