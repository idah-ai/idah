<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  async function acceptInvitation(): Promise<void> {
    try {
      const accountResponse = await accountsBackendDataSource.join({
        token: page.url.searchParams.get("token") as string,
      });
      const passwordResetToken = accountResponse.meta?.password_reset_token || "";

      /* eslint-disable svelte/no-navigation-without-resolve */
      // replaceState so the token URL isn't left as a back-button history entry.
      goto(`/reset-password?token=${passwordResetToken}`, { replaceState: true });
    } catch (error) {
      console.error("Error accepting invitation", error);
      goto(resolve("/error"));
    }
  }

  onMount(() => {
    acceptInvitation();
  });
</script>
