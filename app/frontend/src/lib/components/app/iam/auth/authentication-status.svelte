<script lang="ts">
  import ApplicationLoading from "@/components/app/application/application-loading.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext, authStatus } from "@/security/AuthContext";
  import { onMount, type Snippet } from "svelte";
  import { toast } from "svelte-sonner";
  // Props
  interface Props {
    loading?: Snippet;
    authorized: Snippet;
    unauthorized?: Snippet;
  }
  let { loading, authorized, unauthorized }: Props = $props();
  // Variables
  AuthContext.backend ||= accountAuthService();
  // Lifecycle
  onMount(async () => {
    await checkAuthStatus();
  });
  // Functions
  async function checkAuthStatus(): Promise<void> {
    try {
      await AuthContext.refresh();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Authentication error: ${error.message}`);
      } else {
        // handleVerseError(error)
      }
    }
  }
</script>

<div>
  {#if $authStatus.status === "loading"}
    {#if loading}
      {@render loading?.()}
    {:else}
      <ApplicationLoading />
    {/if}
  {:else if $authStatus.status === "logged-in"}
    {@render authorized()}
  {:else if $authStatus.status === "logged-out"}
    {#if unauthorized}
      {@render unauthorized?.()}
    {:else}
      <Redirect to="/login" />
    {/if}
  {/if}
</div>