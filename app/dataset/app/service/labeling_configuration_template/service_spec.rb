# frozen_string_literal: true

require "spec_helper"

RSpec.describe LabelingConfigurationTemplate::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:template_repo) { LabelingConfigurationTemplate::Repository.new(system_context) }

  # Projects: account 3 owns a project in org 1
  let!(:project_org1) do
    project_repo.create(name: "Project Org 1", created_by_email: "system@example.com", organization_id: 1)
  end
  let!(:project_org2) do
    project_repo.create(name: "Project Org 2", created_by_email: "system@example.com", organization_id: 2)
  end

  let!(:pm_project_owner_org1) do
    project_member_repo.create(
      project_id: project_org1,
      account_id: 3,
      role: "project_owner",
      name: "Project Owner User",
      email: "project_owner@example.com",
      invited_by_id: 1
    )
  end

  let!(:template_org1_id) do
    template_repo.create(
      organization_id: 1,
      name: "Org 1 Template",
      labeling_configuration: { "tools" => ["bbox"] },
      created_by_id: 1,
      updated_by_id: 1
    )
  end

  let(:create_data) do
    {
      data: {
        type: Resource::Dataset::LabelingConfigurationTemplates,
        attributes: {
          organization_id: 1,
          name: "New Template",
          labeling_configuration: { "tools" => ["polygon"] }
        }
      }
    }
  end

  let(:update_data) do
    {
      data: {
        type: Resource::Dataset::LabelingConfigurationTemplates,
        id: template_org1_id,
        attributes: {
          name: "Renamed Template"
        }
      }
    }
  end

  # Permission: Admin — full access
  context "As Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    it "can index" do
      result = subject.index
      expect(result.count).to eq(1)
      expect(result.first.name).to eq("Org 1 Template")
    end

    it "can show" do
      record = subject.show(template_org1_id)
      expect(record.id.to_s).to eq(template_org1_id.to_s)
    end

    it "can create" do
      record = subject.create(deserialize(create_data))

      expect(record.name).to eq("New Template")
      expect(record.organization_id).to eq(1)
      expect(record.created_by_id).to eq(1)
      expect(record.updated_by_id).to eq(1)
    end

    it "can create in any organization" do
      create_data[:data][:attributes][:organization_id] = 2
      record = subject.create(deserialize(create_data))

      expect(record.organization_id).to eq(2)
    end

    it "can update" do
      record = subject.update(deserialize(update_data))

      expect(record.name).to eq("Renamed Template")
      expect(record.updated_by_id).to eq(1)
    end

    it "can delete" do
      subject.delete(template_org1_id)

      expect { template_repo.find!(template_org1_id) }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  # Permission: Org Owner — scoped to owned organization (org 1)
  context "As Org Owner", as: :org_owner do
    subject { described_class.new(current_auth_context) }

    describe "within owned organization" do
      it "can index" do
        expect(subject.index.count).to eq(1)
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.name).to eq("New Template")
        expect(record.organization_id).to eq(1)
        expect(record.created_by_id).to eq(2)
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.name).to eq("Renamed Template")
        expect(record.updated_by_id).to eq(2)
      end

      it "can delete" do
        subject.delete(template_org1_id)

        expect { template_repo.find!(template_org1_id) }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "outside owned organization" do
      let!(:template_org2_id) do
        template_repo.create(
          organization_id: 2,
          name: "Org 2 Template",
          labeling_configuration: {},
          created_by_id: 1,
          updated_by_id: 1
        )
      end

      it "does not index templates from other organizations" do
        expect(subject.index.map(&:organization_id)).to all(eq(1))
      end

      it "cannot create" do
        create_data[:data][:attributes][:organization_id] = 2

        expect { subject.create(deserialize(create_data)) }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        update_data[:data][:id] = template_org2_id

        expect { subject.update(deserialize(update_data)) }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect { subject.delete(template_org2_id) }.to raise_error(Verse::Error::RecordNotFound)
        expect(template_repo.find!(template_org2_id)).not_to be_nil
      end
    end
  end

  # Permission: project_owner user — scoped via project ownership (org 1)
  context "As project_owner user", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    describe "within an organization they own a project in" do
      it "can index" do
        expect(subject.index.count).to eq(1)
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.name).to eq("New Template")
        expect(record.organization_id).to eq(1)
        expect(record.created_by_id).to eq(3)
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.name).to eq("Renamed Template")
        expect(record.updated_by_id).to eq(3)
      end

      it "can delete" do
        subject.delete(template_org1_id)

        expect { template_repo.find!(template_org1_id) }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "in an organization they do not own a project in" do
      it "cannot create" do
        create_data[:data][:attributes][:organization_id] = 2

        expect { subject.create(deserialize(create_data)) }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create this template"
        )
      end
    end
  end

  # Permission: non-owner user (annotator) — no access
  context "As non-owner user", as: :annotator do
    subject { described_class.new(current_auth_context) }

    it "cannot index" do
      expect(subject.index.count).to eq(0)
    end

    it "cannot create" do
      expect { subject.create(deserialize(create_data)) }.to raise_error(Verse::Error::Unauthorized)
    end

    it "cannot update" do
      expect { subject.update(deserialize(update_data)) }.to raise_error(Verse::Error::RecordNotFound)
    end

    it "cannot delete" do
      expect { subject.delete(template_org1_id) }.to raise_error(Verse::Error::RecordNotFound)
    end
  end
end
