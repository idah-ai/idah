# frozen_string_literal: true

require_relative "../lib/resource/dataset"
require_relative "../lib/resource/iam"
require_relative "../lib/project_membership/cache"
require_relative "../lib/project_membership/cache_expo"

RSpec.describe ProjectMembership::CacheExpo do
  let(:cache) { ProjectMembership::Cache.new }
  let(:auth_context) { Verse::Auth::Context[:system] }

  before do
    allow(ProjectMembership::Cache).to receive(:instance).and_return(cache)
  end

  describe "broadcast registration" do
    it "subscribes its resource events in broadcast mode so every process receives them" do
      bus = described_class.on_resource_broadcast(Resource::Dataset::ProjectMembers, "updated")

      expect(bus).to be_a(Verse::Exposition::Hook::EventBus)
      expect(bus.type).to eq(Verse::Event::Manager::MODE_BROADCAST)
      expect(bus.resource_channel).to eq([Resource::Dataset::ProjectMembers, "updated"])
    end
  end

  # Builds an exposition instance whose `message` returns the given content.
  def expo_for(method_name, content, headers: {})
    message = double("message", content: content, headers: headers)
    described_class.new(auth_context, method_name, nil, message: message)
  end

  describe "project_members events" do
    let(:content) do
      {
        resource_id: "pm1",
        metadata: {
          project_member_account_id: 42,
          project_id: "p1",
          organization_id: 7
        }
      }
    end

    %i[on_project_member_created on_project_member_updated on_project_member_deleted].each do |method|
      it "#{method} invalidates the account, project and organization" do
        cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }
        cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { [1] }
        cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { [1] }

        expo_for(method, content).public_send(method)

        expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
        expect(cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { :y }).to eq(:y)
        expect(cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { :z }).to eq(:z)
      end
    end

    it "flushes the whole cache when metadata is missing" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }
      allow(Verse.logger).to receive(:warn)

      expo_for(:on_project_member_created, { resource_id: "pm1", metadata: {} }).on_project_member_created

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
    end
  end

  describe "projects events" do
    it "created invalidates the project and organization" do
      cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { [1] }
      cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { ["p1"] }

      expo_for(:on_project_created, {
        resource_id: "p1",
        metadata: { project_id: "p1", organization_id: 7 }
      }).on_project_created

      expect(cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { :x }).to eq(:x)
      expect(cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { :y }).to eq(:y)
    end

    it "updated invalidates the previous organization when the org changed" do
      cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { ["p1"] }
      cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "8") { ["p1"] }

      expo_for(:on_project_updated, {
        resource_id: "p1",
        metadata: { project_id: "p1", organization_id: 8, previous_organization_id: 7 }
      }).on_project_updated

      expect(cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { :x }).to eq(:x)
      expect(cache.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "8") { :y }).to eq(:y)
    end

    it "updated with previous_organization_id flushes the memberships family" do
      # Cached memberships embed organization_id, so a project move must flush them.
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }

      expo_for(:on_project_updated, {
        resource_id: "p1",
        metadata: { project_id: "p1", organization_id: 8, previous_organization_id: 7 }
      }).on_project_updated

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
    end

    it "updated without previous_organization_id does not flush the memberships family" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }

      expo_for(:on_project_updated, {
        resource_id: "p1",
        metadata: { project_id: "p1", organization_id: 8 }
      }).on_project_updated

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :kept }).to eq([:m])
    end

    it "deleted flushes the whole memberships family" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }
      cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { [1] }

      expo_for(:on_project_deleted, {
        resource_id: "p1",
        metadata: { project_id: "p1", organization_id: 7 }
      }).on_project_deleted

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
      expect(cache.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { :y }).to eq(:y)
    end
  end

  describe "accounts events" do
    it "deleted invalidates the account" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }

      expo_for(:on_account_deleted, { resource_id: 42 }).on_account_deleted

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
    end

    it "updated with enabled: false invalidates the account" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }

      expo_for(:on_account_updated, { resource_id: 42, args: [{ enabled: false }] }).on_account_updated

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :x }).to eq(:x)
    end

    it "updated with enabled: true does not invalidate" do
      cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { [:m] }

      expo_for(:on_account_updated, { resource_id: 42, args: [{ enabled: true }] }).on_account_updated

      expect(cache.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "42") { :kept }).to eq([:m])
    end
  end
end