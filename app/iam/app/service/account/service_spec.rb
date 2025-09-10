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
            attributes: attributes,
          }
        }
      )

      createdAccount = subject.create(record)
      expect(createdAccount.name).to eql("Test Account Name")
      expect(createdAccount.email).to eq("test@example.com")
      expect(createdAccount.enabled).to eq(true)
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
              name: "Updated Text Account Name"
            }
          }
        }
      )

      updated_account = subject.update(record)
      expect(updated_account.name).to eq("Updated Text Account Name")
    end
  end

  describe "#delete" do
    it "deletes an account" do
      account_id = account_repo.create(attributes)
      subject.delete(account_id)
      expect { account_repo.find!(account_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end