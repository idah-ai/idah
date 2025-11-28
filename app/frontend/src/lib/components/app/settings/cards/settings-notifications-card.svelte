<script lang="ts">
  import SettingsCard from "@/components/app/settings/cards/settings-card.svelte";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
  import Switch from "@/components/ui/switch/switch.svelte";

  import {
    accountSettingBackendDataSource,
    datasetCompletedKey,
    orgOwnershipAssignedKey,
    orgOwnershipUnassignedKey,
    projectMemberInvitedKey,
    projectMemberRemovedKey,
  } from "@/data/model/setting/account_setting/record";

  // Variables
  let notifications = $state({
    [orgOwnershipAssignedKey]: true,
    [orgOwnershipUnassignedKey]: true,
    [projectMemberInvitedKey]: true,
    [projectMemberRemovedKey]: true,
    [datasetCompletedKey]: true,
  });
  let allNotificationsChecked = $derived(Object.values(notifications).every((value) => value === true));

  // Functions
  async function loadNotificationSettings() {
    return await Promise.all(Object.keys(notifications).map((key) => loadSetting(key as keyof typeof notifications)));
  }

  async function loadSetting(key: keyof typeof notifications, defaultValue: boolean = true) {
    const response = await accountSettingBackendDataSource.list({
      filters: {
        key,
      },
    });
    notifications[key] = response.data.length ? (response.data[0].value as boolean) : false;

    /** If there is no setting, create one with default value */
    if (!response.data.length) {
      const createdRes = await accountSettingBackendDataSource.create({
        attributes: {
          account_id: "1",
          key,
          value: defaultValue,
        },
      });
      notifications[key] = createdRes.data.value as boolean;
      return createdRes.data;
    }

    return response.data[0];
  }

  async function updateAccountSetting(id: string, value: boolean) {
    await accountSettingBackendDataSource.update(id, {
      attributes: {
        value,
      },
    });
  }

  async function toggleAllNotifications(ids: string[], checkedValue: boolean) {
    if (!ids.length) return;

    ids.forEach(async (id) => {
      await updateAccountSetting(id, checkedValue);
    });

    Object.entries(notifications).forEach(([key]) => {
      notifications[key as keyof typeof notifications] = checkedValue;
    });
  }
</script>

{#await loadNotificationSettings() then [orgOwnershipAssigned, orgOwnershipUnassigned, projectMemberInvited, projectMemberRemoved, datasetCompleted]}
  <SettingsCard title="Notifications">
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>All notifications</ItemTitle>
        <ItemDescription>Receive an email notification for all events.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={allNotificationsChecked}
          onCheckedChange={(checkedValue) => {
            toggleAllNotifications(
              [
                orgOwnershipAssigned.id,
                orgOwnershipUnassigned.id,
                projectMemberInvited.id,
                projectMemberRemoved.id,
                datasetCompleted.id,
              ],
              checkedValue,
            );
          }}
        />
      </ItemActions>
    </Item>
  </SettingsCard>

  <SettingsCard title="Organizations">
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Organization ownership assigned</ItemTitle>
        <ItemDescription>Receive an email notification when organization ownership is assigned.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={notifications[orgOwnershipAssignedKey]}
          onCheckedChange={(checkedChange) => {
            updateAccountSetting(orgOwnershipAssigned.id, checkedChange);
            notifications[orgOwnershipAssignedKey] = checkedChange;
          }}
        />
      </ItemActions>
    </Item>

    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Organization ownership unassigned</ItemTitle>
        <ItemDescription>Receive an email notification when organization ownership is unassigned.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={notifications[orgOwnershipUnassignedKey]}
          onCheckedChange={(checkedChange) => {
            updateAccountSetting(orgOwnershipUnassigned.id, checkedChange);
            notifications[orgOwnershipUnassignedKey] = checkedChange;
          }}
        />
      </ItemActions>
    </Item>
  </SettingsCard>

  <SettingsCard title="Projects">
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Project member invited</ItemTitle>
        <ItemDescription>Receive an email notification when a new member is invited to a project.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={notifications[projectMemberInvitedKey]}
          onCheckedChange={(checkedChange) => {
            updateAccountSetting(projectMemberInvited.id, checkedChange);
            notifications[projectMemberInvitedKey] = checkedChange;
          }}
        />
      </ItemActions>
    </Item>

    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Project member removed</ItemTitle>
        <ItemDescription>Receive an email notification when a project member is removed.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={notifications[projectMemberRemovedKey]}
          onCheckedChange={(checkedChange) => {
            updateAccountSetting(projectMemberRemoved.id, checkedChange);
            notifications[projectMemberRemovedKey] = checkedChange;
          }}
        />
      </ItemActions>
    </Item>

    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Dataset completed</ItemTitle>
        <ItemDescription>Receive an email notification when a dataset is completed.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={notifications[datasetCompletedKey]}
          onCheckedChange={(checkedChange) => {
            updateAccountSetting(datasetCompleted.id, checkedChange);
            notifications[datasetCompletedKey] = checkedChange;
          }}
        />
      </ItemActions>
    </Item>
  </SettingsCard>
{/await}
