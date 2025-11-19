# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:account_repo) { Account::Repository.new(auth_context) }

  let(:attributes) do
    {
      name: "Test Account Name",
      email: "test@example.com",
      enabled: true
    }
  end

  describe "#create" do
    it "creates a new account" do
      record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            attributes:,
          }
        }
      )

      created_account = subject.create(record)
      expect(created_account.name).to eql("Test Account Name")
      expect(created_account.email).to eq("test@example.com")
      expect(created_account.enabled).to eq(true)
    end
  end

  describe "#show" do
    it "shows an account" do
      account_id = account_repo.create(attributes)

      found_account = subject.show(account_id)
      expect(found_account.id.to_s).to eq(account_id)
    end
  end

  describe "#update" do
    it "updates an account" do
      account_id = account_repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: account_id,
            attributes: {
              name: "Updated Test Account Name"
            }
          }
        }
      )

      updated_account = subject.update(record)
      expect(updated_account.name).to eq("Updated Test Account Name")
    end
  end

  describe "#delete" do
    it "deletes an account" do
      account_id = account_repo.create(attributes)
      subject.delete(account_id)
      expect { account_repo.find!(account_id) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#organization owner management" do
    before do
      @user_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "User",
                email: "user@test.com",
                role_name: "user",
                role_scope: "{}",
                enabled: true,
              },
            }
          }
        )
      )
      @org_owner_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "Org Owner",
                email: "org_owner@test.com",
                role_name: "org_owner",
                role_scope: '{"org": [999]}',
                enabled: true,
              },
            }
          }
        )
      )
      @another_org_owner_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "Another Org Owner",
                email: "another_org_owner@test.com",
                role_name: "org_owner",
                role_scope: '{"org": [222, 999]}',
                enabled: true,
              },
            }
          }
        )
      )

      allow_any_instance_of(Organization::Service).to receive(:show).with(anything) do |org_id|
        Verse::JsonApi::Struct.new(
          { id: org_id,
            name: "org #{org_id}", }
        )
      end
    end
  end
end
