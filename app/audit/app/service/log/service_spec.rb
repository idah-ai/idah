# frozen_string_literal: true

require "spec_helper"

RSpec.describe Log::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }
  subject { described_class.new(auth_context) }

  let(:repo) { Log::Repository.new(auth_context) }

  let(:actor_account_id) { 1 }
  let(:actor_account_email) { "admin@example.com" }
  let(:actor_account_role_name) { "admin" }

  # let(:event) { "dataset:datasets:created" }
  # let(:content) do
  #   {
  #     args: [],
  #     resource_id: UUIDv7.generate,
  #     metadata: {
  #       expo: "DatasetsExpo",
  #       service: "Dataset::Service",
  #       at: Time.now,
  #       account_id: 1,
  #       actor_account_id:,
  #       actor_account_email:
  #     }
  #   }
  # end

  let(:action) { "created" }
  # let(:resource_service) { "dataset" }
  # let(:resource_type) { "datasets" }
  # let(:resource_id) { UUIDv7.generate }

  # let(:attributes) do
  #   {
  #     action:,
  #     resource_service:,
  #     resource_type:,
  #     resource_id: resource_id,
  #     event_timestamp: Time.now,
  #     actor_account_id:,
  #     actor_account_email:,
  #     actor_account_role_name:,
  #     organization_id: 1,
  #     project_id: UUIDv7.generate,
  #     dataset_id: resource_id,
  #   }
  # end
  # 
  let(:attributes) do
    {
      action: action,
      actor_account_id: actor_account_id,
      actor_account_email: actor_account_email,
      actor_account_role_name: actor_account_role_name,
      event_timestamp: Time.now,
    }
  end

  describe "#create" do
    it "creates an audit log for organization record" do
      # attributes preparation
      resource_service = "iam"
      resource_type = "organizations"
      resource_id = "1"
      organization_id = resource_id
      attributes.merge!(
        resource_service:,
        resource_type:,
        resource_id:,
        organization_id:,
      )
      # event = "iam:organizations:created"
      # content = {
      #   args: [],
      #   resource_id: organization_id,
      #   metadata: {
      #     # usually included in the message
      #     expo: "OrganizationsExpo",
      #     service: "Organization::Service",
      #     at: Time.now,
      #     account_id: actor_account_id,
      #     # added metadata
      #     actor_account_id:,
      #     actor_account_email:
      #   }
      # }
      # expect(content[:metadata]&.[](:organization_id)).to be_nil # should be extracted from resource_id

      log = subject.create(attributes)

      expect(log.action).to eq action
      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_service).to eq "iam"
      expect(log.resource_type).to eq "organizations"
      expect(log.resource_id).to eq resource_id
      expect(log.organization_id).to eq resource_id.to_i
      expect(log.project_id).to be_nil
      expect(log.dataset_id).to be_nil
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for project record" do
      # attributes preparation
      resource_service = "dataset"
      resource_type = "projects"
      resource_id = UUIDv7.generate
      organization_id = 1
      project_id = resource_id
      attributes.merge!(
        resource_service:,
        resource_type:,
        resource_id:,
        organization_id:,
        project_id:,
      )

      # project_id = UUIDv7.generate
      # event = "dataset:projects:created"
      # content = {
      #   args: [],
      #   resource_id: project_id,
      #   metadata: {
      #     # usually included in the message
      #     expo: "ProjectsExpo",
      #     service: "Project::Service",
      #     at: Time.now,
      #     account_id: actor_account_id,
      #     # added metadata
      #     actor_account_id:,
      #     actor_account_email:,
      #     organization_id: 1
      #   }
      # }
      # expect(content[:metadata]&.[](:project_id)).to be_nil # should be extracted from resource_id

      log = subject.create(attributes)

      expect(log.action).to eq action
      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "projects"
      expect(log.resource_id).to eq resource_id
      expect(log.organization_id).to eq organization_id
      expect(log.project_id).to eq resource_id
      expect(log.dataset_id).to be_nil
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for dataset record" do
      # attributes preparation
      resource_service = "dataset"
      resource_type = "datasets"
      resource_id = UUIDv7.generate
      organization_id = 1
      project_id = UUIDv7.generate
      dataset_id = resource_id
      attributes.merge!(
        resource_service:,
        resource_type:,
        resource_id:,
        organization_id:,
        project_id:,
        dataset_id:,
      )

      # dataset_id = UUIDv7.generate
      # event = "dataset:datasets:created"
      # content = {
      #   args: [],
      #   resource_id: dataset_id,
      #   metadata: {
      #     # usually included in the message
      #     expo: "DatasetsExpo",
      #     service: "Dataset::Service",
      #     at: Time.now,
      #     account_id: actor_account_id,
      #     # added metadata
      #     actor_account_id:,
      #     actor_account_email:,
      #     organization_id: 1,
      #     project_id: UUIDv7.generate
      #   }
      # }
      # expect(content[:metadata]&.[](:dataset_id)).to be_nil # should be extracted from resource_id

      log = subject.create(attributes)


      expect(log.action).to eq action
      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "datasets"
      expect(log.resource_id).to eq resource_id
      expect(log.organization_id).to eq organization_id
      expect(log.project_id).to eq project_id
      expect(log.dataset_id).to eq resource_id
      expect(log.entry_id).to be_nil
    end

    it "creates an audit log for entry record" do
      # attributes preparation
      resource_service = "dataset"
      resource_type = "entries"
      resource_id = UUIDv7.generate
      organization_id = 1
      project_id = UUIDv7.generate
      dataset_id = UUIDv7.generate
      entry_id = resource_id
      attributes.merge!(
        resource_service:,
        resource_type:,
        resource_id:,
        organization_id:,
        project_id:,
        dataset_id:,
        entry_id:,
      )

      # entry_id = UUIDv7.generate
      # event = "dataset:entries:created"
      # content = {
      #   args: [],
      #   resource_id: entry_id,
      #   metadata: {
      #     # usually included in the message
      #     expo: "EntriesExpo",
      #     service: "Entry::Service",
      #     at: Time.now,
      #     account_id: actor_account_id,
      #     # added metadata
      #     actor_account_id:,
      #     actor_account_email:,
      #     organization_id: 1,
      #     project_id: UUIDv7.generate,
      #     dataset_id: UUIDv7.generate
      #   }
      # }
      # expect(content[:metadata]&.[](:entry_id)).to be_nil # should be extracted from resource_id

      log = subject.create(attributes)

      expect(log.action).to eq action
      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "entries"
      expect(log.resource_id).to eq resource_id
      expect(log.organization_id).to eq organization_id
      expect(log.project_id).to eq project_id
      expect(log.dataset_id).to eq dataset_id
      expect(log.entry_id).to eq resource_id
    end
  end

  describe "#show" do
    before do
      @resource_service = "dataset"
      @resource_type = "datasets"
      @resource_id = UUIDv7.generate
      @organization_id = 1
      @project_id = UUIDv7.generate
      @dataset_id = @resource_id
      attributes.merge!(
        resource_service: @resource_service,
        resource_type: @resource_type,
        resource_id: @resource_id,
        organization_id: @organization_id,
        project_id: @project_id,
        dataset_id: @resource_id,
      )

      @log1 = subject.create(attributes)
    end

    it "show an audit log" do
      log = subject.show(@log1.id)

      expect(log.action).to eq action
      expect(log.actor_account_id).to eq actor_account_id
      expect(log.actor_account_email).to eq actor_account_email
      expect(log.resource_service).to eq @resource_service
      expect(log.resource_type).to eq @resource_type
      expect(log.resource_id).to eq @resource_id
      expect(log.organization_id).to eq @organization_id
      expect(log.project_id).to eq @project_id
      expect(log.dataset_id).to eq @resource_id
      expect(log.entry_id).to be_nil
    end
  end

  describe "#index" do
    before do
      @resource_service = "dataset"
      @resource_type = "datasets"
      @resource_id = UUIDv7.generate
      @organization_id = 1
      @project_id = UUIDv7.generate
      @dataset_id = @resource_id
      attributes.merge!(
        resource_service: @resource_service,
        resource_type: @resource_type,
        resource_id: @resource_id,
        organization_id: @organization_id,
        project_id: @project_id,
        dataset_id: @resource_id,
      )

      subject.create(attributes)
      subject.create(attributes)
    end

    it "list audit logs" do
      logs = subject.index({})

      expect(logs.size).to eq 2
    end
  end
end
