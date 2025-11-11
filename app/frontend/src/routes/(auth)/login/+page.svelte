<script lang="ts">
  import AuthenticationAlert from "@/components/app/iam/auth/alert/authentication-alert.svelte";
  import AuthenticationCard from "@/components/app/iam/auth/card/authentication-card.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { loginSchema } from "@/data/model/iam/accounts/auth-schema";
  import { goto } from "$app/navigation";

  // Variables
  let resource: string = "iam:account";
  let showErrorAlert = $state(false);
  let credentials = $state({
    email: "",
    password: "",
  });
  let disabledSignInButton = $derived.by(() => {
    const validated = loginSchema.safeParse(credentials);
    return !validated.success;
  });

  // Functions
  async function logIn(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          cookie: true,
        }),
      });

      console.log("response: ", response);

      // if (!response.ok) {
      //   showErrorAlert = true;
      //   return;
      // }

      const body = await response.json();
      console.log("body: ", body);

      if (body.errors) throw body.errors;
      // if (body && body.data) return body;
      if (body && body.data) goto("/");
      // token = body.meta.token

      throw "No body returned";

      // localStorage.setItem("authToken", body.token);
    } catch (error) {
      showErrorAlert = true;
    }
  }
</script>

<AuthenticationCard title="Welcome Back!" description="We missed you!. Please enter your details.">
  {#snippet alert()}
    {#if showErrorAlert}
      <AuthenticationAlert title="Incorrect email or password" description="Please try again."></AuthenticationAlert>
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
        value={credentials.email}
        oninput={(e) => (credentials.email = e.currentTarget.value)}
      ></InputField>

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

      <div class="flex items-center justify-end">
        <Link href="/forgot-password" class="text-primary text-sm">Forgot password?</Link>
      </div>

      <Button class="w-full" disabled={disabledSignInButton} onclick={logIn}>Sign In</Button>
    </Form>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-center gap-2">
      <Text size="sm" class="text-muted-foreground">Don't have an account?</Text>
      <Link href="/sign-up" class="text-sm">Sign up</Link>
    </div>
  {/snippet}
</AuthenticationCard>
