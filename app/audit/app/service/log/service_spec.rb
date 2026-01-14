# frozen_string_literal: true

require "spec_helper"

RSpec.describe Log::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }
  subject { described_class.new(auth_context) }

  let(:repo) { Log::Repository.new(auth_context) }

  let(:actor_account_id) { 1 }
  let(:actor_account_email) { "admin@example.com" }

  let(:event) { "dataset:datasets:created" }
  let(:content) do
    {
      args: [],
      resource_id: UUIDv7.generate,
      metadata: {
        expo: "DatasetsExpo",
        service: "Dataset::Service",
        at: Time.now,
        account_id: 1,
        actor_account_id:,
        actor_account_email:
      }
    }
  end

  describe "#create_from_event" do
    it "creates an audit log" do
      log = subject.create_from_event(event, content)

      expect(log.action).to eq "created"
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "datasets"
      expect(log.resource_id).to eq content[:resource_id]
      expect(log.actor_account_id).to eq 1
    end

    it "creates an audit log for organization record" do
      organization_id = 1
      event = "iam:organizations:created"
      content = {
        args: [],
        resource_id: organization_id,
        metadata: {
          # usually included in the message
          expo: "OrganizationsExpo",
          service: "Organization::Service",
          at: Time.now,
          account_id: actor_account_id,
          # added metadata
          actor_account_id:,
          actor_account_email:
        }
      }
      expect(content[:metadata]&.[](:organization_id)).to be_nil # should be extracted from resource_id

      log = subject.create_from_event(event, content)

      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_type).to eq "organizations"
      expect(log.organization_id).to eq content[:resource_id]
      expect(log.project_id).to be_nil
      expect(log.dataset_id).to be_nil
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for project record" do
      project_id = UUIDv7.generate
      event = "dataset:projects:created"
      content = {
        args: [],
        resource_id: project_id,
        metadata: {
          # usually included in the message
          expo: "ProjectsExpo",
          service: "Project::Service",
          at: Time.now,
          account_id: actor_account_id,
          # added metadata
          actor_account_id:,
          actor_account_email:,
          organization_id: 1
        }
      }
      expect(content[:metadata]&.[](:project_id)).to be_nil # should be extracted from resource_id

      log = subject.create_from_event(event, content)

      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_type).to eq "projects"
      expect(log.organization_id).to eq content[:metadata][:organization_id]
      expect(log.project_id).to eq content[:resource_id]
      expect(log.dataset_id).to be_nil
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for dataset record" do
      dataset_id = UUIDv7.generate
      event = "dataset:datasets:created"
      content = {
        args: [],
        resource_id: dataset_id,
        metadata: {
          # usually included in the message
          expo: "DatasetsExpo",
          service: "Dataset::Service",
          at: Time.now,
          account_id: actor_account_id,
          # added metadata
          actor_account_id:,
          actor_account_email:,
          organization_id: 1,
          project_id: UUIDv7.generate
        }
      }
      expect(content[:metadata]&.[](:dataset_id)).to be_nil # should be extracted from resource_id

      log = subject.create_from_event(event, content)

      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_type).to eq "datasets"
      expect(log.organization_id).to eq content[:metadata][:organization_id]
      expect(log.project_id).to eq content[:metadata][:project_id]
      expect(log.dataset_id).to eq content[:resource_id]
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for entry record" do
      entry_id = UUIDv7.generate
      event = "dataset:entries:created"
      content = {
        args: [],
        resource_id: entry_id,
        metadata: {
          # usually included in the message
          expo: "EntriesExpo",
          service: "Entry::Service",
          at: Time.now,
          account_id: actor_account_id,
          # added metadata
          actor_account_id:,
          actor_account_email:,
          organization_id: 1,
          project_id: UUIDv7.generate,
          dataset_id: UUIDv7.generate
        }
      }
      expect(content[:metadata]&.[](:entry_id)).to be_nil # should be extracted from resource_id

      log = subject.create_from_event(event, content)

      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_type).to eq "entries"
      expect(log.organization_id).to eq content[:metadata][:organization_id]
      expect(log.project_id).to eq content[:metadata][:project_id]
      expect(log.dataset_id).to eq content[:metadata][:dataset_id]
      expect(log.entry_id).to eq content[:resource_id]
    end
  end

  describe "#show" do
    before do
      @log1 = subject.create_from_event(event, content)
    end

    it "show an audit log" do
      log = subject.show(@log1.id)

      expect(log.action).to eq "created"
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "datasets"
      expect(log.resource_id).to eq content[:resource_id]
      expect(log.actor_account_id).to eq 1
    end
  end

  describe "#index" do
    before do
      subject.create_from_event(event, content)
      subject.create_from_event(event, content)
    end

    it "list audit logs" do
      logs = subject.index({})

      expect(logs.size).to eq 2
    end
  end
end
