# frozen_string_literal: true

require "spec_helper"

RSpec.describe Organization::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:organization_repo) { Organization::Repository.new(auth_context) }

  let(:test_org_name) { "Test Organization" }
  let(:attributes) { { name: test_org_name } }

  describe "#create" do
    it "creates an organization" do
      record = deserialize(
        {
          data: {
            type: Resource::Iam::Organizations,
            attributes:,
          }
        }
      )

      created_org = subject.create(record)
      expect(created_org.name).to eq(test_org_name)
    end
  end

  describe "#show" do
    it "shows an organization" do
      organization_id = organization_repo.create(attributes)

      found_organization = subject.show(organization_id)
      expect(found_organization.id.to_s).to eq(organization_id)
    end
  end

  describe "#update" do
    it "updates an organization" do
      organization_id = organization_repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: Resource::Iam::Organizations,
            id: organization_id,
            attributes: {
              name: "Updated Test Organization"
            }
          }
        }
      )

      updated_organization = subject.update(record)
      expect(updated_organization.name).to eq("Updated Test Organization")
    end
  end

  describe "#delete" do
    before do
      allow(Api[:idah].dataset.projects).to receive(:index).and_return(Verse::JsonApi::Struct.new([]))
    end

    it "deletes an organization" do
      organization_id = organization_repo.create(attributes)
      subject.delete(organization_id)
      expect { organization_repo.find!(organization_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
