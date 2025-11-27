<script lang="ts">
  import SettingsCard from "@/components/app/settings/cards/settings-card.svelte";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
  import Switch from "@/components/ui/switch/switch.svelte";

  // Variables
  let allNotifications = $state(true);
  let orgOwnershipAssigned = $state(false);
  let orgOwnershipUnassigned = $state(true);
  let projectMemberInvited = $state(true);
  let projectMemberRemoved = $state(false);
  let datasetCompleted = $state(true);

  // Functions
  function toggleAllNotifications() {
    allNotifications = !allNotifications;

    orgOwnershipAssigned = allNotifications;
    orgOwnershipUnassigned = allNotifications;
    projectMemberInvited = allNotifications;
    projectMemberRemoved = allNotifications;
    datasetCompleted = allNotifications;
  }
</script>

<SettingsCard title="Notifications">
  <Item variant="outline">
    <ItemContent>
      <ItemTitle>All notifications</ItemTitle>
      <ItemDescription>Receive an email notification for all events.</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch checked={allNotifications} onCheckedChange={toggleAllNotifications} />
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
      <Switch checked={orgOwnershipAssigned} />
    </ItemActions>
  </Item>

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Organization ownership unassigned</ItemTitle>
      <ItemDescription>Receive an email notification when organization ownership is unassigned.</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch checked={orgOwnershipUnassigned} />
    </ItemActions>
  </Item>
</SettingsCard>

<SettingsCard title="Projects">
  <!-- <Item variant="outline">
      <ItemContent>
        <ItemTitle>New account created</ItemTitle>
        <ItemDescription>Receive an email notification when a new account is created.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch />
      </ItemActions>
    </Item> -->

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Project member invited</ItemTitle>
      <ItemDescription>Receive an email notification when a new member is invited to a project.</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch checked={projectMemberInvited} />
    </ItemActions>
  </Item>

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Project member removed</ItemTitle>
      <ItemDescription>Receive an email notification when a project member is removed.</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch checked={projectMemberRemoved} />
    </ItemActions>
  </Item>

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Dataset completed</ItemTitle>
      <ItemDescription>Receive an email notification when a dataset is completed.</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch checked={datasetCompleted} />
    </ItemActions>
  </Item>
</SettingsCard>
