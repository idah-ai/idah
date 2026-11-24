# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project::Service, "storage targets", database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }

  let(:target_id) { "0194f5a2-0000-7000-8000-000000000001" }
  let(:target) do
    StorageTargetLookup::Target.new(
      id: target_id,
      name: "Acme bucket",
      endpoint: "https://s3.example.com",
      bucket: "acme-bucket",
      enabled: true,
      organization_ids: [1]
    )
  end

  before { allow(StorageTargetLookup).to receive(:find).and_return(nil) }

  def create_input(**attributes)
    deserialize(
      {
        data: {
          type: Resource::Dataset::Projects,
          attributes: { name: "Confidential", organization_id: 1, **attributes }
        }
      }
    )
  end

  def update_input(id, **attributes)
    deserialize({ data: { type: Resource::Dataset::Projects, id:, attributes: } })
  end

  context "as an org owner of organization 1", as: :org_owner do
    subject(:service) { described_class.new(current_auth_context) }

    it "creates a project in a target allowed for its organization" do
      expect(StorageTargetLookup).to receive(:find).with(target_id, fresh: true).and_return(target)

      project = service.create(create_input(storage_target_id: target_id))

      expect(project.storage_target_id).to eq(target_id)
    end

    it "creates a project in the default storage when no target is given, without asking setting" do
      project = service.create(create_input)

      expect(project.storage_target_id).to be_nil
      expect(StorageTargetLookup).not_to have_received(:find)
    end

    it "treats an empty target as the default storage" do
      expect(service.create(create_input(storage_target_id: "")).storage_target_id).to be_nil
    end

    {
      "isn't allowed for the organization" => { organization_ids: [2] },
      "is disabled" => { enabled: false }
    }.each do |reason, change|
      it "refuses a target that #{reason}, and creates nothing" do
        allow(StorageTargetLookup).to receive(:find).and_return(target.with(**change))

        expect {
          service.create(create_input(storage_target_id: target_id))
        }.to raise_error(Verse::Error::ValidationFailed, /#{target_id}/)
        expect(project_repo.index({})).to be_empty
      end
    end

    it "refuses a target setting doesn't know, or that is archived" do
      expect {
        service.create(create_input(storage_target_id: target_id))
      }.to raise_error(Verse::Error::ValidationFailed)
    end
  end

  context "as an admin", as: :admin do
    subject(:service) { described_class.new(current_auth_context) }

    let!(:project_id) do
      project_repo.create(
        name: "Confidential", created_by_email: "a@example.com", organization_id: 1, storage_target_id: target_id
      )
    end

    it "refuses to change a project's target" do
      expect {
        service.update(update_input(project_id, storage_target_id: UUIDv7.generate))
      }.to raise_error(Verse::Error::ValidationFailed, /storage_target_id/)
    end

    it "refuses to remove it" do
      expect {
        service.update(update_input(project_id, storage_target_id: nil))
      }.to raise_error(Verse::Error::ValidationFailed, /storage_target_id/)
    end

    it "accepts the same target sent back with other changes" do
      project = service.update(update_input(project_id, name: "Renamed", storage_target_id: target_id))

      expect(project).to have_attributes(name: "Renamed", storage_target_id: target_id)
    end

    it "refuses to move the project to an organization its target doesn't allow" do
      allow(StorageTargetLookup).to receive(:find).with(target_id, fresh: true).and_return(target)

      expect {
        service.update(update_input(project_id, organization_id: 2))
      }.to raise_error(Verse::Error::ValidationFailed, /organization/)
      expect(project_repo.find!(project_id).organization_id).to eq(1)
    end

    it "moves it to an organization its target allows" do
      allow(StorageTargetLookup).to receive(:find).with(target_id, fresh: true)
                                                  .and_return(target.with(organization_ids: [1, 2]))

      expect(service.update(update_input(project_id, organization_id: 2)).organization_id).to eq(2)
    end

    describe "#storage_target_summary" do
      it "gives the target's name and location" do
        allow(StorageTargetLookup).to receive(:find).with(target_id).and_return(target)

        expect(service.storage_target_summary(project_repo.find!(project_id))).to eq(
          id: target_id, name: "Acme bucket", endpoint: "https://s3.example.com", bucket: "acme-bucket"
        )
      end

      it "still names an archived target by its id" do
        expect(service.storage_target_summary(project_repo.find!(project_id))).to eq(id: target_id, archived: true)
      end

      it "is nil for a project in the default storage" do
        default = project_repo.create(name: "Plain", created_by_email: "a@example.com", organization_id: 1)

        expect(service.storage_target_summary(project_repo.find!(default))).to be_nil
      end
    end
  end
end
