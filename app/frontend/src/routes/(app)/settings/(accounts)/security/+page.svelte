<script lang="ts">
  import Settings2faCard from "@/components/app/settings/cards/settings-2fa-card.svelte";
  import SettingsSignInMethodsCard from "@/components/app/settings/cards/settings-sign-in-methods-card.svelte";

  import { settingBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  pageBreadcrumbsStore.set([
    settingBreadcrumb,
    {
      label: "Security",
    },
  ]);
</script>

<SettingsSignInMethodsCard />

<Settings2faCard />
