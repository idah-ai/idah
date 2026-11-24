# frozen_string_literal: true

require "spec_helper"

RSpec.describe LogsExpo, type: :exposition, as: :system do
  let(:service) { instance_double(Log::Service) }

  before do
    allow(Log::Service).to receive(:new).and_return(service)
  end

  describe "account events" do
    before do
      @resource_type = "iam:accounts"
      @resource_id = 1
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "AccountsExpo",
          service: "Account::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin"
        }
      }
    end

    %w[created updated deleted logged_in].each do |event|
      it "processes account #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end

    it "skips an event without actor_account_id with a warning, no exception" do
      @content[:metadata].delete(:actor_account_id)
      expect(service).not_to receive(:create)
      allow(Verse.logger).to receive(:warn)

      expect {
        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: "deleted",
          payload: @content
        )
      }.not_to raise_error

      expect(Verse.logger).to have_received(:warn).with(/no actor_account_id/)
    end
  end

  describe "account session events" do
    before do
      @resource_type = "iam:account_sessions"
      @resource_id = 111
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "AccountSessionExpo",
          service: "AccountSession::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin"
        }
      }
    end

    %w[logged_out].each do |event|
      it "processes account session #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end
  end

  describe "organization events" do
    before do
      @resource_type = "iam:organizations"
      @resource_id = 1
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "OrganizationsExpo",
          service: "Organization::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin",
          organization_id: @resource_id,
        }
      }
    end

    %w[created updated deleted].each do |event|
      it "processes organization #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end
  end

  describe "storage target events" do
    let(:content) do
      {
        args: [],
        resource_id: "0194f5a2-0000-7000-8000-000000000001",
        metadata: {
          at: Time.now,
          actor_account_id: 1,
          actor_account_email: "admin@example.com",
          actor_account_role_name: "admin",
          secret_changed: true
        }
      }
    end

    %w[created updated deleted].each do |event|
      it "logs a storage target #{event} event against the target" do
        expect(service).to receive(:create).with(
          hash_including(
            action: event,
            resource_service: "setting",
            resource_type: "storage_targets",
            resource_id: "0194f5a2-0000-7000-8000-000000000001",
            actor_account_id: 1
          )
        )

        Verse.publish_resource_event(
          resource_type: Resource::Setting::StorageTargets,
          resource_id: content[:resource_id],
          event:,
          payload: content
        )
      end
    end
  end

  describe "project events" do
    before do
      @resource_type = "dataset:projects"
      @resource_id = UUIDv7.generate
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "ProjectsExpo",
          service: "Project::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin",
          organization_id: 1,
          project_id: @resource_id
        }
      }
    end

    %w[created updated deleted].each do |event|
      it "processes project #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end
  end

  describe "project member events" do
    before do
      @resource_type = "dataset:project_members"
      @resource_id = 22
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "ProjectMembersExpo",
          service: "ProjectMember::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin",
          project_id: UUIDv7.generate
        }
      }
    end

    %w[created updated deleted].each do |event|
      it "processes project member #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end
  end

  describe "dataset events" do
    before do
      @resource_type = "dataset:datasets"
      @resource_id = UUIDv7.generate
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "DatasetsExpo",
          service: "Dataset::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin",
          organization_id: 1,
          project_id: UUIDv7.generate,
          dataset_id: @resource_id
        }
      }
    end

    %w[created updated deleted].each do |event|
      it "processes dataset #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end
  end

  describe "entry events" do
    before do
      @resource_type = "dataset:entries"
      @resource_id = UUIDv7.generate
      @content = {
        args: [],
        resource_id: @resource_id,
        metadata: {
          expo: "EntriesExpo",
          service: "Entry::Service",
          at: Time.now,
          account_id: 1,
          actor_account_id: 1,
          actor_account_email: "test@example.com",
          actor_account_role_name: "admin",
          organization_id: 1,
          project_id: UUIDv7.generate,
          dataset_id: UUIDv7.generate,
          entry_id: @resource_id,
          submission_type: "submitted"
        }
      }
    end

    %w[created updated deleted assigned unassigned reopened submitted].each do |event|
      it "processes entry #{event} event" do
        expect_any_instance_of(LogsExpo).to receive(:log_attributes)
        expect(service).to receive(:create)

        Verse.publish_resource_event(
          resource_type: @resource_type,
          resource_id: @resource_id,
          event: event,
          payload: @content
        )
      end
    end

    it "ignores entry submitted event without submission_type" do
      @content[:metadata].delete(:submission_type)
      expect(service).not_to receive(:create)

      Verse.publish_resource_event(
        resource_type: @resource_type,
        resource_id: @resource_id,
        event: "submitted",
        payload: @content
      )
    end

    it "ignores entry submitted event with start submission_type" do
      @content[:metadata][:submission_type] = "start"
      expect(service).not_to receive(:create)

      Verse.publish_resource_event(
        resource_type: @resource_type,
        resource_id: @resource_id,
        event: "submitted",
        payload: @content
      )
    end
  end
end
