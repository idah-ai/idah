<script lang="ts">
  import SettingsAppearanceCard from "@/components/app/settings/cards/settings-appearance-card.svelte";

  import { settingBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  pageBreadcrumbsStore.set([
    settingBreadcrumb,
    {
      label: "Appearance",
    },
  ]);
</script>

<SettingsAppearanceCard />
