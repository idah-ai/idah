<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  import ApplicationContent from "@/components/app/application/application-content.svelte";
  import ApplicationSidebar from "@/components/app/application/sidebar/application-sidebar.svelte";
  import AuthenticationStatus from "@/components/app/iam/auth/authentication-status.svelte";
  import SidebarProvider from "@/components/ui/sidebar/sidebar-provider.svelte";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<AuthenticationStatus>
  {#snippet authorized()}
    <SidebarProvider>
      <ApplicationSidebar></ApplicationSidebar>

      <!-- MAIN APPLICATION -->
      <ApplicationContent>
        {@render children?.()}
      </ApplicationContent>
    </SidebarProvider>
  {/snippet}
</AuthenticationStatus>
