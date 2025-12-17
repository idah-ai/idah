<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { LockIcon, LockOpenIcon, MailIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationStatus from "@/components/app/iam/auth/authentication-status.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Link from "@/components/ui/text/Link.svelte";

  import { loginSchema } from "@/data/model/iam/accounts/auth-schema";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext } from "@/security/AuthContext";

  // Variables
  let resource: string = "iam:account";
  let showPassword = $state(false);
  let signingIn = $state(false);
  let email = $state("");
  let password = $state("");
  let disabledSignInButton = $derived.by(() => {
    const validated = loginSchema.safeParse({ email: email, password: password });
    return !validated.success;
  });
  let redirectTo = page.url.searchParams.get("redirectTo") || "/projects";

  AuthContext.backend ||= accountAuthService();

  const errorMessages = {
    invalid_credentials: {
      title: "Incorrect email or password",
      description: "Please try again.",
    },
    account_disabled: {
      title: "Account disabled",
      description: "Your account has been disabled. Please contact support.",
    },
    error: {
      title: "An error occurred",
      description: "Please try again later.",
    },
  };

  let errorCode: "invalid_credentials" | "account_disabled" | "error" | null = $state(null);

  // Functions
  async function signInWithEmailAndPassword(): Promise<void> {
    signingIn = true;

    await AuthContext.signInWithEmailAndPassword(email, password).then(() => {
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      goto(redirectTo);
    }).catch((error) => {
      if(error.status == 401) {
        errorCode = error.errors[0].detail;
      } else {
        errorCode = "error";
        throw error;
      }
    }).finally(() => {
      signingIn = false;
    });
  }

  function toggleShowPassword(): void {
    showPassword = !showPassword;
  }
</script>

<AuthenticationStatus>
  {#snippet authorized()}
    <Redirect to="/projects" />
  {/snippet}

  {#snippet unauthorized()}
    <AuthenticationCard title="Welcome Back!" description="We missed you! Please enter your details.">
      {#snippet alert()}
        {#if errorCode}
          <AuthenticationAlert
            title={errorMessages[errorCode].title}
            description={errorMessages[errorCode].description}
          />
        {/if}
      {/snippet}

      {#snippet content()}
        <Form>
          <!-- EMAIL -->
          <InputField
            name="{resource}/email"
            label="Email"
            prefixIcon={MailIcon}
            placeholder="Enter your email"
            value={email}
            oninput={(e) => (email = e.currentTarget.value)}
          />

          <!-- PASSWORD -->
          <section class="flex flex-col">
            <InputField
              name="{resource}/password"
              label="Password"
              type={showPassword ? "text" : "password"}
              prefixIcon={showPassword ? LockOpenIcon : LockIcon}
              placeholder="Enter your password"
              value={password}
              oninput={(e) => (password = e.currentTarget.value)}
            />

            <div class="flex items-center justify-between">
              <Button variant="link" class="p-0" onclick={toggleShowPassword}>
                {showPassword ? "Hide" : "Show"} password
              </Button>

              <Link href="/forgot-password" class="text-primary text-sm">Forgot password?</Link>
            </div>
          </section>

          <Button
            type="submit"
            class="w-full"
            loading={signingIn}
            loadingLabel="Logging In..."
            disabled={disabledSignInButton}
            onclick={signInWithEmailAndPassword}
          >
            Login
          </Button>
        </Form>
      {/snippet}
    </AuthenticationCard>
  {/snippet}
</AuthenticationStatus>
